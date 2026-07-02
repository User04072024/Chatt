import { useState, useRef } from "react"
import { useLocation, Link } from "wouter"
import { useUser } from "@/hooks/use-user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { uploadToCatbox } from "@/lib/catbox"
import { ChevronLeft, Camera, Loader2 } from "lucide-react"

export default function Profile() {
  const { user, updateProfile } = useUser()
  const [, setLocation] = useLocation()
  
  if (!user) {
    setLocation("/")
    return null
  }

  const [nombre, setNombre] = useState(user.nombre)
  const [estado, setEstado] = useState(user.estado || "")
  const [descripcion, setDescripcion] = useState(user.descripcion || "")
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return
    setLoading(true)
    try {
      await updateProfile({ nombre, estado, descripcion })
      setLocation("/chat")
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const url = await uploadToCatbox(file)
      await updateProfile({ avatar: url })
    } catch (error) {
      console.error("Upload failed", error)
    } finally {
      setUploadingAvatar(false)
    }
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col">
      <div className="h-16 flex items-center px-4 border-b border-border bg-card">
        <Link href="/chat">
          <Button variant="ghost" size="icon" className="mr-2">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h2 className="font-semibold text-lg">Perfil</h2>
      </div>

      <div className="flex-1 p-4 flex justify-center mt-8">
        <div className="w-full max-w-md bg-card p-6 rounded-2xl border border-border shadow-sm">
          
          <div className="flex flex-col items-center mb-8">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar className="w-24 h-24 border-4 border-background shadow-md">
                <AvatarImage src={user.avatar || undefined} />
                <AvatarFallback name={user.nombre} className="text-2xl" />
              </Avatar>
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
            </div>
            <p className="text-xs text-muted-foreground mt-3">Toca para cambiar foto</p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Nombre</label>
              <Input 
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="h-11 rounded-xl bg-background"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Estado</label>
              <Input 
                value={estado}
                onChange={e => setEstado(e.target.value)}
                placeholder="Ej. Disponible, Ocupado..."
                className="h-11 rounded-xl bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Descripción (Bio)</label>
              <textarea 
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Un poco sobre ti..."
                className="w-full rounded-xl bg-background border border-input p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full h-11 rounded-xl mt-4" disabled={loading || !nombre.trim()}>
              {loading ? "Guardando..." : "Guardar cambios"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
