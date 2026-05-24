import { useState } from "react"

interface AddPromptProps {
  onAdd: (text: string) => Promise<void>
}

export default function AddPrompt({ onAdd }: AddPromptProps) {
  const [text, setText] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    await onAdd(text)
    setText("")
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginTop: 16 }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="+ 프롬프트 추가..."
        style={{ flex: 1, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4, fontSize: 14 }}
      />
      <button type="submit" disabled={!text.trim()} style={{ padding: "8px 16px", background: text.trim() ? "#333" : "#ccc", color: "white", border: "none", borderRadius: 4, cursor: text.trim() ? "pointer" : "default", fontSize: 14 }}>추가</button>
    </form>
  )
}
