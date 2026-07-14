import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { User } from "./use-user"

export type Message = {
  id: string
  emisor_id: string
  receptor_id: string
  contenido: string | null
  tipo: 'texto' | 'imagen' | 'video' | 'pegatina'
  archivo_url: string | null
  estado: 'enviado' | 'recibido' | 'visto'
  visto: boolean
  responded: boolean
  created_at: string
  expires_at: string | null
}

export function useChat(currentUser: User | null, selectedUserId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const usersRef = useRef<User[]>([])
  useEffect(() => { usersRef.current = users }, [users])

  // Request notification permission on first load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Fetch users & subscribe to presence
  useEffect(() => {
    if (!currentUser) return

    const fetchUsers = async () => {
      const { data } = await supabase.from('usuarios').select('*').order('last_seen', { ascending: false })
      if (data) setUsers(data)
    }
    fetchUsers()

    const usersChannel = supabase.channel('public:usuarios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setUsers(prev => [payload.new as User, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setUsers(prev => prev.map(u => u.id === payload.new.id ? payload.new as User : u))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(usersChannel)
    }
  }, [currentUser])

  // Fetch messages & subscribe to current conversation
  useEffect(() => {
    if (!currentUser || !selectedUserId) {
      setMessages([])
      return
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('mensajes')
        .select('*')
        .or(`and(emisor_id.eq.${currentUser.id},receptor_id.eq.${selectedUserId}),and(emisor_id.eq.${selectedUserId},receptor_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true })
      
      if (data) {
        setMessages(data)
        // Mark unread as seen
        const unreadIds = data.filter(m => m.receptor_id === currentUser.id && !m.visto).map(m => m.id)
        if (unreadIds.length > 0) {
          markAsSeen(unreadIds)
        }
      }
    }

    fetchMessages()

    const msgChannel = supabase.channel(`mensajes:${currentUser.id}-${selectedUserId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'mensajes' 
      }, (payload) => {
        // Filter manually to ensure we only get messages for this pair
        const msg = (payload.new || payload.old) as Message
        const isParticipant = (msg.emisor_id === currentUser.id && msg.receptor_id === selectedUserId) || 
                              (msg.emisor_id === selectedUserId && msg.receptor_id === currentUser.id)
                              
        if (!isParticipant) return

        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as Message
          setMessages(prev => [...prev, newMsg])
          
          if (newMsg.receptor_id === currentUser.id) {
            // New message arrived for me
            playNotificationSound()
            if (document.hidden) {
              document.title = "• Nuevo mensaje"
            }
            // Browser notification — only sender name, never the content
            if ('Notification' in window && Notification.permission === 'granted') {
              const sender = usersRef.current.find(u => u.id === newMsg.emisor_id)
              const senderName = sender?.nombre || "Alguien"
              new Notification(senderName, {
                icon: "/icons/icon-192.png",
                badge: "/icons/icon-192.png",
                tag: `msg-${newMsg.emisor_id}`,
                renotify: true,
                silent: true,
              })
            }
            // Mark as seen immediately if we are actively viewing
                if (!document.hidden) {
                setTimeout(() => {
                markAsSeen([newMsg.id])
             }, 150)
            }
          }
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new as Message : m))
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      })
      .subscribe()

       useEffect(() => {
        if (!currentUser || !selectedUserId) return

       const unread = messages
         .filter(
           m =>
           m.receptor_id === currentUser.id &&
           m.emisor_id === selectedUserId &&
          !m.visto
       )
        .map(m => m.id)

       if (unread.length) {
        markAsSeen(unread)
      }
    }, [messages, currentUser?.id, selectedUserId])
    
    // Typing indicator channel
    const sortedIds = [currentUser.id, selectedUserId].sort()
    const typingChan = supabase.channel(`typing:${sortedIds[0]}-${sortedIds[1]}`)
    
    typingChan.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.userId === selectedUserId) {
        setTypingUsers(prev => {
          const next = new Set(prev)
          next.add(selectedUserId)
          return next
        })
        // Auto clear after 3s
        setTimeout(() => {
          setTypingUsers(prev => {
            const next = new Set(prev)
            next.delete(selectedUserId)
            return next
          })
        }, 3000)
      }
    }).subscribe()

    channelRef.current = typingChan

    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(typingChan)
    }
  }, [currentUser, selectedUserId])

  // Handle document visibility changes to clear title notification
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        document.title = "Messenger"
        // Mark all unread from current chat as seen
        if (currentUser && selectedUserId) {
          const unreadIds = messages.filter(m => m.receptor_id === currentUser.id && !m.visto).map(m => m.id)
          if (unreadIds.length > 0) {
            markAsSeen(unreadIds)
          }
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [messages, currentUser, selectedUserId])

  // Auto delete logic (tick every second)
  // Both sender and receiver attempt deletion — idempotent, whichever is online wins
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      setMessages(prev => {
        let changed = false
        const next = prev.filter(m => {
          if (m.expires_at && new Date(m.expires_at) <= now) {
            // Both sides attempt delete — idempotent, whichever client is live wins
            supabase.from('mensajes').delete().eq('id', m.id).then()
            changed = true
            return false
          }
          return true
        })
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const markAsSeen = async (ids: string[]) => {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 60000).toISOString() // 60 seconds from now

    // Locally update state right away for speed
    setMessages(prev => prev.map(m => 
      ids.includes(m.id) ? { ...m, visto: true, estado: 'visto', expires_at: m.expires_at || expiresAt } : m
    ))

    await supabase
      .from('mensajes')
      .update({ visto: true, estado: 'visto', expires_at: expiresAt })
      .in('id', ids)
  }

  const sendTyping = () => {
    if (channelRef.current && currentUser) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUser.id }
      })
    }
  }

  const sendMessage = async (contenido: string, tipo: 'texto'|'imagen'|'video'|'pegatina' = 'texto', archivo_url: string | null = null) => {
    if (!currentUser || !selectedUserId) {
      console.warn("[sendMessage] abortado: no hay usuario o chat seleccionado", { currentUser, selectedUserId })
      return
    }

    // Find if we are replying to any unseen messages and mark them responded
    const recentReceived = messages.filter(m => m.receptor_id === currentUser.id && !m.responded)
    if (recentReceived.length > 0) {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 60000).toISOString()
      const idsToUpdate = recentReceived.map(m => m.id)
      supabase
        .from('mensajes')
        .update({ responded: true, expires_at: expiresAt })
        .in('id', idsToUpdate)
        .then()
    }

    // For stickers, contenido is the URL so the row is never empty
    const finalContenido = contenido || archivo_url || ""

    const newMsg = {
      emisor_id: currentUser.id,
      receptor_id: selectedUserId,
      contenido: finalContenido,
      tipo,
      archivo_url,
      estado: 'enviado',
      visto: false,
      responded: false
    }

    const { error } = await supabase.from('mensajes').insert([newMsg])
    if (error) {
      console.error("[sendMessage] error al insertar:", error)
    }
  }

  return { messages, users, typingUsers, sendMessage, sendTyping }
}

let audioCtx: AudioContext | null = null;
function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, audioCtx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1)
    
    gain.gain.setValueAtTime(0, audioCtx.currentTime)
    gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05)
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2)
    
    osc.start(audioCtx.currentTime)
    osc.stop(audioCtx.currentTime + 0.2)
  } catch (e) {
    // Ignore audio errors
  }
}
