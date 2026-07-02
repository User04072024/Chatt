import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export type User = {
  id: string
  public_id: string
  nombre: string
  avatar: string | null
  estado: string
  descripcion: string | null
  online: boolean
  created_at: string
  last_seen: string
}

export function useUser() {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("currentUser")
    return stored ? JSON.parse(stored) : null
  })

  // Basic presence & last seen handler
  useEffect(() => {
    if (!user) return

    const updatePresence = async (online: boolean) => {
      try {
        await supabase
          .from("usuarios")
          .update({ online, last_seen: new Date().toISOString() })
          .eq("id", user.id)
      } catch (e) {
        console.error("Failed to update presence", e)
      }
    }

    // Set online
    updatePresence(true)

    // Polling presence just in case (every 30s)
    const interval = setInterval(() => {
      updatePresence(true)
    }, 30000)

    const handleBeforeUnload = () => {
      // Sync xhr for reliable execution on unload
      const data = JSON.stringify({ online: false, last_seen: new Date().toISOString() })
      const blob = new Blob([data], { type: 'application/json' })
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/usuarios?id=eq.${user.id}`
      navigator.sendBeacon(url, blob) // Not perfectly reliable for auth, but we try
      
      // Also try async fetch
      updatePresence(false)
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      updatePresence(false)
    }
  }, [user?.id])

  const login = async (nombre: string) => {
    // Search for user
    const { data: existing, error: selectError } = await supabase
      .from("usuarios")
      .select("*")
      .eq("nombre", nombre)
      .single()

    // PGRST116 = no rows found → create new user; anything else = real error
    if (selectError && selectError.code !== "PGRST116") {
      throw new Error(`Error al buscar usuario: ${selectError.message}`)
    }

    let finalUser = existing

    if (!existing) {
      // Create user
      const { data: created, error: insertError } = await supabase
        .from("usuarios")
        .insert([{ 
          nombre, 
          public_id: crypto.randomUUID(), 
          estado: 'Disponible',
          online: true 
        }])
        .select()
        .single()
        
      if (insertError) throw new Error(`Error al crear usuario: ${insertError.message}`)
      finalUser = created
    } else {
      // Update existing
      const { error: updateError } = await supabase
        .from("usuarios")
        .update({ online: true, last_seen: new Date().toISOString() })
        .eq("id", existing.id)
      if (updateError) throw new Error(`Error al actualizar sesión: ${updateError.message}`)
    }

    localStorage.setItem("currentUser", JSON.stringify(finalUser))
    setUser(finalUser)
    return finalUser
  }

  const logout = () => {
    if (user) {
      supabase
        .from("usuarios")
        .update({ online: false, last_seen: new Date().toISOString() })
        .eq("id", user.id)
        .then()
    }
    localStorage.removeItem("currentUser")
    setUser(null)
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return
    const { data, error } = await supabase
      .from("usuarios")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single()
      
    if (error) throw error
    if (data) {
      localStorage.setItem("currentUser", JSON.stringify(data))
      setUser(data)
    }
    return data
  }

  return { user, login, logout, updateProfile }
}
