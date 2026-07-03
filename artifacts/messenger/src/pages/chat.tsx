import { useState, useRef, useEffect, useCallback } from "react"
import { useLocation, Link } from "wouter"
import { useUser } from "@/hooks/use-user"
import { useChat, Message } from "@/hooks/use-chat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  MessageSquare, Search, MoreVertical, Paperclip, Send, Check, CheckCheck,
  Loader2, X, ChevronLeft, Moon, Sun, UserCircle, LogOut,
  Download, Smile, Trash2, ZoomIn, Sticker
} from "lucide-react"
import { uploadToCatbox } from "@/lib/catbox"
import { format, isToday, isYesterday, formatDistanceToNowStrict } from "date-fns"
import { es } from "date-fns/locale"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

// ─── URL safety ───────────────────────────────────────────────────────────
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch { return false }
}

// ─── Sticker storage helpers (scoped per user) ────────────────────────────
function stickerKey(userId: string) { return `chatt_stickers:${userId}` }
function loadStickers(userId: string): string[] {
  try { return JSON.parse(localStorage.getItem(stickerKey(userId)) || "[]") } catch { return [] }
}
function saveSticker(userId: string, url: string): string[] {
  if (!isSafeUrl(url)) return loadStickers(userId)
  const stickers = loadStickers(userId)
  if (stickers.includes(url)) return stickers
  const next = [url, ...stickers]
  localStorage.setItem(stickerKey(userId), JSON.stringify(next))
  return next
}
function deleteSticker(userId: string, url: string): string[] {
  const next = loadStickers(userId).filter(s => s !== url)
  localStorage.setItem(stickerKey(userId), JSON.stringify(next))
  return next
}

// ─── Image download helper ─────────────────────────────────────────────────
async function downloadImage(url: string) {
  if (!isSafeUrl(url)) return
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `chatt-${Date.now()}.${blob.type.split("/")[1] || "jpg"}`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch {
    const parsed = new URL(url)
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }
}

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
  const [mobileView, setMobileView] = useState<"list" | "chat">("list")

  // Image viewer / action sheet
  const [imageAction, setImageAction] = useState<{ url: string; mode: "actions" | "lightbox" } | null>(null)

  // Sticker picker
  const [showStickerPicker, setShowStickerPicker] = useState(false)
  const [stickers, setStickers] = useState<string[]>(() => loadStickers(user.id))

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
      const isVideo = file.type.startsWith("video/")
      await sendMessage(file.name, isVideo ? "video" : "imagen", url)
    } catch (error) {
      console.error(error)
      alert("Error al subir el archivo")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleConvertToSticker = useCallback((url: string) => {
    const next = saveSticker(user.id, url)
    setStickers(next)
    setImageAction(null)
  }, [user.id])

  const handleDeleteSticker = useCallback((url: string) => {
    setStickers(deleteSticker(user.id, url))
  }, [user.id])

  const handleSendSticker = async (url: string) => {
    setShowStickerPicker(false)
    await sendMessage("", "pegatina", url)
  }

  const selectUser = (id: string) => {
    setSelectedUserId(id)
    setMobileView("chat")
    setShowStickerPicker(false)
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className={cn(
        "flex-col w-full md:w-[380px] border-r border-border bg-card/30",
        mobileView === "list" ? "flex" : "hidden md:flex"
      )}>
        <div className="p-4 flex items-center justify-between border-b border-border bg-card">
          <h2 className="font-semibold text-xl tracking-tight">Chats</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            <Link href="/profile">
              <Button variant="ghost" size="icon"><UserCircle className="w-5 h-5" /></Button>
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
                <p className="text-sm text-muted-foreground truncate">{u.estado || "Disponible"}</p>
              </div>
            </div>
          ))}
        </div>

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

      {/* ── Main Chat Area ───────────────────────────────────────────────── */}
      <div className={cn(
        "flex-1 flex-col bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed dark:opacity-90",
        mobileView === "chat" ? "flex" : "hidden md:flex"
      )}>
        {selectedUser ? (
          <>
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-border bg-card shadow-sm z-10">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={() => setMobileView("list")}>
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
              <Button variant="ghost" size="icon"><MoreVertical className="w-5 h-5" /></Button>
            </div>

            {/* Messages list */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 no-scrollbar">
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => {
                  const isMe = msg.emisor_id === user.id
                  const showDate = idx === 0 || !isSameDay(new Date(msg.created_at), new Date(messages[idx - 1].created_at))
                  const isSticker = msg.tipo === "pegatina"

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
                        className={cn("flex mb-1", isMe ? "justify-end" : "justify-start")}
                      >
                        {/* ── Pegatina: sin burbuja ── */}
                        {isSticker && msg.archivo_url ? (
                          <div className="flex flex-col items-end gap-1">
                            <img
                              src={msg.archivo_url}
                              alt="Pegatina"
                              className="w-36 h-36 object-contain rounded-2xl cursor-pointer hover:scale-105 transition-transform drop-shadow-md"
                              onClick={() => setImageAction({ url: msg.archivo_url!, mode: "actions" })}
                            />
                            <div className="flex items-center gap-1 px-1">
                              <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                                {format(new Date(msg.created_at), "HH:mm")}
                              </span>
                              {isMe && (
                                msg.visto
                                  ? <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                                  : msg.estado === "recibido"
                                  ? <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
                                  : <Check className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        ) : (
                          /* ── Burbuja normal ── */
                          <div className={cn(
                            "max-w-[75%] md:max-w-[60%] rounded-2xl p-3 shadow-sm relative group",
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-card border border-border rounded-bl-sm"
                          )}>
                            {msg.tipo === "imagen" && msg.archivo_url && (
                              <img
                                src={msg.archivo_url}
                                alt="Adjunto"
                                className="w-full max-h-64 object-cover rounded-xl mb-2 cursor-pointer active:opacity-80 transition-opacity"
                                onClick={() => setImageAction({ url: msg.archivo_url!, mode: "actions" })}
                              />
                            )}

                            {msg.tipo === "video" && msg.archivo_url && (
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
                                {format(new Date(msg.created_at), "HH:mm")}
                              </span>
                              {isMe && (
                                msg.visto
                                  ? <CheckCheck className="w-4 h-4 text-blue-300" />
                                  : msg.estado === "recibido"
                                  ? <CheckCheck className="w-4 h-4" />
                                  : <Check className="w-4 h-4" />
                              )}
                              {msg.expires_at && <Countdown expiresAt={msg.expires_at} />}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  )
                })}
              </AnimatePresence>
            </div>

            {/* ── Sticker Picker Panel ── */}
            <AnimatePresence>
              {showStickerPicker && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 200, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="bg-card border-t border-border overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                    <span className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Sticker className="w-4 h-4" /> Mis pegatinas
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowStickerPicker(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {stickers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                      <Smile className="w-8 h-8 opacity-40" />
                      <p className="text-xs text-center">
                        Aún no tienes pegatinas.<br />
                        Pulsa una imagen del chat → <strong>Convertir en pegatina</strong>
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-3 p-3 overflow-x-auto no-scrollbar">
                      {stickers.map((url, i) => (
                        <div key={i} className="relative group shrink-0">
                          <img
                            src={url}
                            alt="Pegatina"
                            className="w-20 h-20 object-contain rounded-xl cursor-pointer hover:scale-110 transition-transform border border-border bg-background/50"
                            onClick={() => handleSendSticker(url)}
                          />
                          <button
                            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                            onClick={e => { e.stopPropagation(); setStickers(deleteSticker(user.id, url)) }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

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

                {/* Sticker button */}
                <Button
                  type="button"
                  variant={showStickerPicker ? "secondary" : "ghost"}
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl"
                  onClick={() => setShowStickerPicker(v => !v)}
                >
                  <Sticker className="w-5 h-5" />
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

      {/* ── Image Action Sheet ──────────────────────────────────────────── */}
      <AnimatePresence>
        {imageAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-end md:justify-center p-0 md:p-6"
            onClick={() => setImageAction(null)}
          >
            {imageAction.mode === "lightbox" ? (
              /* ── Full Lightbox ── */
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="w-full h-full flex items-center justify-center p-4"
                onClick={e => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
                  onClick={() => setImageAction(null)}
                >
                  <X className="w-6 h-6" />
                </Button>
                <img src={imageAction.url} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
              </motion.div>
            ) : (
              /* ── Action Sheet ── */
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                className="w-full md:w-[400px] bg-card rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                {/* Preview */}
                <div className="bg-black/40 flex items-center justify-center p-4 h-52">
                  <img
                    src={imageAction.url}
                    className="max-w-full max-h-full object-contain rounded-xl"
                  />
                </div>

                {/* Actions */}
                <div className="p-2">
                  <ActionButton
                    icon={<ZoomIn className="w-5 h-5" />}
                    label="Ver en pantalla completa"
                    onClick={() => setImageAction({ url: imageAction.url, mode: "lightbox" })}
                  />
                  <ActionButton
                    icon={<Download className="w-5 h-5" />}
                    label="Descargar imagen"
                    onClick={() => { downloadImage(imageAction.url); setImageAction(null) }}
                  />
                  <ActionButton
                    icon={<Sticker className="w-5 h-5" />}
                    label={stickers.includes(imageAction.url) ? "Ya es una pegatina ✓" : "Convertir en pegatina"}
                    onClick={() => handleConvertToSticker(imageAction.url)}
                    disabled={stickers.includes(imageAction.url)}
                    accent
                  />
                  {stickers.includes(imageAction.url) && (
                    <ActionButton
                      icon={<Trash2 className="w-5 h-5" />}
                      label="Eliminar de mis pegatinas"
                      onClick={() => { setStickers(deleteSticker(user.id, imageAction.url)); setImageAction(null) }}
                      danger
                    />
                  )}
                </div>

                <div className="p-2 border-t border-border">
                  <button
                    className="w-full py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-accent/30"
                    onClick={() => setImageAction(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ActionButton({
  icon, label, onClick, accent, danger, disabled
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  accent?: boolean
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium transition-colors",
        disabled
          ? "opacity-50 cursor-not-allowed text-muted-foreground"
          : danger
          ? "text-destructive hover:bg-destructive/10"
          : accent
          ? "text-primary hover:bg-primary/10"
          : "text-foreground hover:bg-accent/40"
      )}
    >
      {icon}
      {label}
    </button>
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
    <span className="ml-2 font-mono bg-black/20 px-1 rounded-sm text-[10px]">{secondsLeft}s</span>
  )
}
