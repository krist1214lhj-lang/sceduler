const log = document.getElementById("log")
const input = document.getElementById("input")
let dogName = "뽀식이"

function add(text, who) {
  const div = document.createElement("div")
  div.className = `msg ${who}`
  div.textContent = text
  log.appendChild(div)
  log.scrollTop = log.scrollHeight
}

function send(text) {
  text = text.trim()
  if (!text) return
  add(text, "me")
  window.pet.sendChat(text)
}

window.pet.getSettings().then((s) => {
  dogName = s.name
  document.title = `${dogName}랑 대화하기`
  add(`왈! 저는 ${dogName}예요. 하고 싶은 말을 써 주세요! "앉아", "손", "간식" 같은 말도 알아들어요~`, "dog")
})
window.pet.onSettings((s) => {
  dogName = s.name
  document.title = `${dogName}랑 대화하기`
})
window.pet.onChatReply((text) => add(text, "dog"))

document.getElementById("form").addEventListener("submit", (e) => {
  e.preventDefault()
  send(input.value)
  input.value = ""
  input.focus()
})
document.querySelectorAll("#chips button").forEach((b) => b.addEventListener("click", () => send(b.textContent)))
