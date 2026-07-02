import { useState, useRef, useEffect, useMemo } from "react"
import { useLocation, Link } from "wouter"
import { useUser } from "@/hooks/use-user"
import { useChat, Message } from "@/hooks/use-chat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageSquare, Search, MoreVertical, Paperclip, Send, Check, CheckCheck, Loader2, Image as ImageIcon, X, ChevronLeft, Moon, Sun, UserCircle, LogOut } from "lucide-react"
import { uploadToCatbox } from "@/lib/catbox"
import { format, isToday, isYesterday, formatDistanceToNowStrict } from "date-fns"
import { es } from "date-fns/locale"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

export default function Chat() {
  const { user, logout } = useUser()
  const [, setLocation] = useLocation()
  
  if (!user) {
    setLocation("/")
    return null
  }

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [inputValue, setInputValue] = useState("")
  const [uploading, setUploading] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const { theme, setTheme } = useTheme()
  const { messages, users, typingUsers, sendMessage, sendTyping } = useChat(user, selectedUserId)

  const selectedUser = users.find(u => u.id === selectedUserId)
  const filteredUsers = users.filter(u => 
    u.id !== user.id && 
    u.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputValue.trim()) return
    await sendMessage(inputValue)
    setInputValue("")
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploading(true)
    try {
      const url = await uploadToCatbox(file)
      const isVideo = file.type.startsWith('video/')
      await sendMessage(file.name, isVideo ? 'video' : 'imagen', url)
    } catch (error) {
      console.error(error)
      alert("Error al subir el archivo")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const selectUser = (id: string) => {
    setSelectedUserId(id)
    setMobileView('chat')
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      {/* Sidebar - Users List */}
      <div className={cn(
        "flex-col w-full md:w-[380px] border-r border-border bg-card/30",
        mobileView === 'list' ? 'flex' : 'hidden md:flex'
      )}>
        <div className="p-4 flex items-center justify-between border-b border-border bg-card">
          <h2 className="font-semibold text-xl tracking-tight">Chats</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            <Link href="/profile">
              <Button variant="ghost" size="icon">
                <UserCircle className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
        
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar chats..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-card border-none h-10 rounded-xl"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-2">
          {filteredUsers.map(u => (
            <div 
              key={u.id}
              onClick={() => selectUser(u.id)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors mb-1",
                selectedUserId === u.id ? "bg-accent/50" : "hover:bg-accent/30"
              )}
            >
              <div className="relative">
                <Avatar>
                  <AvatarImage src={u.avatar || undefined} />
                  <AvatarFallback name={u.nombre} />
                </Avatar>
                {u.online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 border-2 border-background bg-green-500 rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-medium truncate">{u.nombre}</h3>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {u.estado || "Disponible"}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Current user footer */}
        <div className="p-4 border-t border-border bg-card/50 flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user.avatar || undefined} />
            <AvatarFallback name={user.nombre} />
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{user.nombre}</p>
            <p className="text-xs text-green-500">Conectado</p>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-destructive shrink-0">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={cn(
        "flex-1 flex-col bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed dark:opacity-90",
        mobileView === 'chat' ? 'flex' : 'hidden md:flex'
      )}>
        {selectedUser ? (
          <>
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-border bg-card shadow-sm z-10">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={() => setMobileView('list')}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Avatar className="w-10 h-10">
                  <AvatarImage src={selectedUser.avatar || undefined} />
                  <AvatarFallback name={selectedUser.nombre} />
                </Avatar>
                <div>
                  <h2 className="font-medium leading-none mb-1">{selectedUser.nombre}</h2>
                  <p className="text-xs text-muted-foreground">
                    {typingUsers.has(selectedUser.id) ? (
                      <span className="text-primary italic animate-pulse">Escribiendo...</span>
                    ) : selectedUser.online ? (
                      <span className="text-green-500">en línea</span>
                    ) : (
                      `últ. vez ${formatDistanceToNowStrict(new Date(selectedUser.last_seen), { addSuffix: true, locale: es })}`
                    )}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </div>

            {/* Messages list */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar"
            >
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => {
                  const isMe = msg.emisor_id === user.id
                  const showDate = idx === 0 || !isSameDay(new Date(msg.created_at), new Date(messages[idx - 1].created_at))
                  
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-6">
                          <span className="text-xs font-medium bg-card border border-border px-3 py-1 rounded-full shadow-sm">
                            {formatDateSeparator(new Date(msg.created_at))}
                          </span>
                        </div>
                      )}
                      
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("flex", isMe ? "justify-end" : "justify-start")}
                      >
                        <div className={cn(
                          "max-w-[75%] md:max-w-[60%] rounded-2xl p-3 shadow-sm relative group",
                          isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"
                        )}>
                          {msg.tipo === 'imagen' && msg.archivo_url && (
                            <img 
                              src={msg.archivo_url} 
                              alt="Adjunto" 
                              className="w-full max-h-64 object-cover rounded-xl mb-2 cursor-pointer"
                              onClick={() => setLightboxUrl(msg.archivo_url)}
                            />
                          )}
                          
                          {msg.tipo === 'video' && msg.archivo_url && (
                            <video 
                              src={msg.archivo_url} 
                              controls
                              className="w-full max-h-64 object-cover rounded-xl mb-2"
                            />
                          )}

                          {msg.contenido && (
                            <p className="text-sm break-words whitespace-pre-wrap">{msg.contenido}</p>
                          )}
                          
                          <div className={cn(
                            "flex items-center justify-end gap-1.5 mt-1",
                            isMe ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}>
                            <span className="text-[10px] uppercase font-medium tracking-wider">
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </span>
                            
                            {isMe && (
                              <span className="text-[14px]">
                                {msg.visto ? <CheckCheck className="w-4 h-4 text-blue-300" /> : 
                                 msg.estado === 'recibido' ? <CheckCheck className="w-4 h-4" /> : 
                                 <Check className="w-4 h-4" />}
                              </span>
                            )}
                            
                            {msg.expires_at && (
                              <Countdown expiresAt={msg.expires_at} />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )
                })}
              </AnimatePresence>
            </div>

            {/* Input area */}
            <div className="p-3 bg-card border-t border-border">
              <form onSubmit={handleSend} className="flex items-end gap-2 max-w-4xl mx-auto">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                />
                
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className="h-11 w-11 shrink-0 rounded-xl"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                </Button>
                
                <div className="flex-1 relative">
                  <Input 
                    value={inputValue}
                    onChange={e => {
                      setInputValue(e.target.value)
                      sendTyping()
                    }}
                    placeholder="Escribe un mensaje..."
                    className="w-full rounded-xl bg-background border-border h-11 pr-4"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl bg-primary hover:bg-primary/90"
                  disabled={!inputValue.trim() && !uploading}
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
            <div className="w-20 h-20 bg-card rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-border">
              <MessageSquare className="w-10 h-10 opacity-50" />
            </div>
            <h2 className="text-xl font-medium text-foreground mb-2">Messenger Web</h2>
            <p className="max-w-xs">Selecciona un chat en la barra lateral o busca a alguien para comenzar a conversar.</p>
          </div>
        )}
      </div>

      {/* Lightbox for images */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setLightboxUrl(null)}
            >
              <X className="w-6 h-6" />
            </Button>
            <img src={lightboxUrl} className="max-w-full max-h-full object-contain rounded-lg" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

function formatDateSeparator(date: Date) {
  if (isToday(date)) return "Hoy"
  if (isYesterday(date)) return "Ayer"
  return format(date, "EEEE d 'de' MMMM", { locale: es })
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    const calc = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }
    calc()
    const int = setInterval(calc, 1000)
    return () => clearInterval(int)
  }, [expiresAt])

  if (secondsLeft <= 0) return null

  return (
    <span className="ml-2 font-mono bg-black/20 px-1 rounded-sm text-[10px]">
      {secondsLeft}s
    </span>
  )
}
