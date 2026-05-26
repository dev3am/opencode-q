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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="+ 프롬프트 추가... (Shift+Enter로 개행)"
        rows={2}
        style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4, fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
      />
      <button type="submit" disabled={!text.trim()} style={{ marginTop: 4, padding: "8px 16px", background: text.trim() ? "#333" : "#ccc", color: "white", border: "none", borderRadius: 4, cursor: text.trim() ? "pointer" : "default", fontSize: 14 }}>추가</button>
    </form>
  )
}
