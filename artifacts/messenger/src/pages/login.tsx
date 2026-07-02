import { useState } from "react"
import { useLocation } from "wouter"
import { useUser } from "@/hooks/use-user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageSquare, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

export default function Login() {
  const [nombre, setNombre] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login, user } = useUser()
  const [, setLocation] = useLocation()

  // Redirect if already logged in
  if (user) {
    setLocation("/chat")
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = nombre.trim()
    if (!name) return

    try {
      setLoading(true)
      setError(null)

      // Timeout de 10s para no quedar cargando eternamente
      const loginPromise = login(name)
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Tiempo agotado. Verifica tu conexión.")), 10000)
      )
      await Promise.race([loginPromise, timeout])
      setLocation("/chat")
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "No se pudo conectar con el servidor. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background text-foreground p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <MessageSquare className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Messenger</h1>
          <p className="text-muted-foreground text-sm mt-1">Ingresa con tu nombre para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-center">
              {error}
            </div>
          )}
          <div className="relative">
            <Input 
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre completo"
              className="pl-4 pr-12 h-12 text-base rounded-xl bg-card border-card-border focus-visible:ring-primary shadow-sm"
              disabled={loading}
              autoFocus
            />
            <Button 
              type="submit" 
              size="icon"
              className="absolute right-1.5 top-1.5 h-9 w-9 rounded-lg"
              disabled={!nombre.trim() || loading}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
