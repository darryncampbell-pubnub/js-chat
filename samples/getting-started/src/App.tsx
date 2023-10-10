import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  Channel,
  Chat,
  Message,
  MixedTextTypedElement,
  TimetokenUtils,
  User,
  ThreadMessage,
} from "@pubnub/chat"
import "./App.css"

const userData = [
  {
    id: "support-agent",
    data: { name: "John (Support Agent)", custom: { initials: "SA", avatar: "#9fa7df" } },
  },
  {
    id: "supported-user",
    data: { name: "Mary Watson", custom: { initials: "MW", avatar: "#ffab91" } },
  },
]

//const randomizedUsers = Math.random() < 0.5 ? userData : userData.reverse()
const randomizedUsers = document.location.search.includes("agent") ? userData : userData.reverse()

export default function App() {
  const [chat, setChat] = useState<Chat>()
  const [text, setText] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [channel, setChannel] = useState<Channel>()
  const [messages, setMessages] = useState<Message[]>([])
  const messageListRef = useRef<HTMLElement>(null)
  const [typers, setTypers] = useState("")
  const [membership, setMembership] = useState<undefined | Membership>()
  const [readReceipts, setReadReceipts] = useState({})
  const [newMessageDraft, setNewMessageDraft] = useState<MessageDraft>()

  async function handleSend(event: React.SyntheticEvent) {
    event.preventDefault()
    if (!text || !channel) return

    //  Sending standard messages
    //await channel.sendText(text)
    //setText("")

    //  Sending a message with user mentions (will render users as URLs)
    newMessageDraft.send()
    setNewMessageDraft(channel.createMessageDraft({ userSuggestionSource: "channel" }))
    setText("")
  }

  async function handleMessage(message: Message) {
    if (chat && !users.find((user) => user.id === message.userId)) {
      const user = await chat.getUser(message.userId)
      if (user) setUsers((users) => [...users, user])
    }
    setMessages((messages) => [...messages, message])
  }

  function removeDuplicateActions(dupArray) {
    if (!dupArray) return null
    const uniqueArr = []
    for (let i = 0; i < dupArray.length; i++) {
      let add = true
      for (let j = 0; j < uniqueArr.length; j++) {
        if (
          dupArray[i].uuid == uniqueArr[j].uuid &&
          dupArray[i].actionTimetoken == uniqueArr[j].actionTimetoken
        ) {
          add = false
          continue
        }
      }
      if (add) {
        uniqueArr.push(dupArray[i])
      }
    }
    return uniqueArr
  }

  async function handleToggleReaction(message, reaction) {
    const newMsg = await message.toggleReaction(reaction)
    setMessages((msgs) => msgs.map((msg) => (msg.timetoken === newMsg.timetoken ? newMsg : msg)))
  }

  async function markMessageRead(message: Message) {
    await membership.setLastReadMessage(message)
  }

  async function handleInput(event) {
    //  Input handler for User Mentions (modify send() logic to call send() on the messageDraft)
    const response = await newMessageDraft.onChange(event.target.value)
    if (response.users?.suggestedUsers?.length > 0) {
      //  There is a suggested user.  For this demo, just automatically replace the text in the message input
      //  In production, you would offer a user a list of suggestions.
      newMessageDraft.addMentionedUser(
        response.users.suggestedUsers[0],
        response.users.nameOccurrenceIndex
      )
      setText(newMessageDraft.value)
    }
  }

  useEffect(() => {
    if (!messageListRef.current) return
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    if (!messages.length) return
    return ThreadMessage.streamUpdatesOn(messages, setMessages)
  }, [messages])

  useEffect(() => {
    if (!channel) return
    //  User mentions
    setNewMessageDraft(channel.createMessageDraft({ userSuggestionSource: "channel" }))
  }, [channel])

  useEffect(() => {
    if (!channel) return
    return channel.connect((message) => setMessages((messages) => [...messages, message]))
  }, [channel])

  useEffect(() => {
    async function initalizeChat() {
      const chat = await Chat.init({
        publishKey: import.meta.env.VITE_PUBNUB_PUB_KEY,
        subscribeKey: import.meta.env.VITE_PUBNUB_SUB_KEY,
        userId: randomizedUsers[0].id,
        typingTimeout: 5000,
      })
      const currentUser = await chat.currentUser.update(randomizedUsers[0].data)
      const interlocutor =
        (await chat.getUser(randomizedUsers[1].id)) ||
        (await chat.createUser(randomizedUsers[1].id, randomizedUsers[1].data))
      const { channel, hostMembership } = await chat.createDirectConversation({
        user: interlocutor,
        channelData: { name: "Support Channel" },
      })
      setChat(chat)
      setUsers([currentUser, interlocutor])
      setChannel(channel)
      setMembership(hostMembership)

      channel.getTyping((data) => {
        //  Returns an array of typers (user IDs)
        let typers = ""
        if (data && data.length > 0) typers = "Typing: "
        data.forEach(async (typer) => {
          const typingUser = await chat.getUser(typer)
          typers += typingUser.name + " - "
          setTypers(typers)
        })
        setTypers(typers)
      })

      //  Retrieve the channel's history.  Need to have created users for this to work
      const channelHistory = await channel.getHistory({ count: 10 })
      setMessages([])
      channelHistory.messages.forEach(async (historicalMessage) => {
        await handleMessage(historicalMessage)
      })

      //  Listen for read receipts
      const stopReceipts = await channel.streamReadReceipts((receipts) => {
        // callback to handle current receipts data
        setReadReceipts(receipts)
      })
    }

    initalizeChat()
  }, [])

  const renderMessagePart = useCallback((messagePart: MixedTextTypedElement) => {
    if (messagePart.type === "text") {
      return messagePart.content.text
    }
    if (messagePart.type === "plainLink") {
      return <a href={messagePart.content.link}>{messagePart.content.link}</a>
    }
    if (messagePart.type === "textLink") {
      return <a href={messagePart.content.link}>{messagePart.content.text}</a>
    }
    if (messagePart.type === "mention") {
      return <a href={`https://pubnub.com/${messagePart.content.id}`}>{messagePart.content.name}</a>
    }

    return ""
  }, [])

  if (!chat || !channel) return <p>Loading...</p>

  return (
    <main>
      <header>
        <h3>{channel.name}</h3>
        <h3>{chat.currentUser.name}</h3>
      </header>

      <section className="message-list" ref={messageListRef}>
        <ol>
          {messages.map((message) => {
            const user = users.find((user) => user.id === message.userId)
            return (
              <li key={message.timetoken}>
                <aside style={{ background: String(user?.custom?.avatar) }}>
                  {user?.custom?.initials}
                </aside>
                <article>
                  <h3>
                    {user?.name}
                    <time>
                      {TimetokenUtils.timetokenToDate(message.timetoken).toLocaleTimeString([], {
                        timeStyle: "short",
                      })}
                    </time>
                  </h3>
                  <p>
                    {message
                      .getLinkedText()
                      .map((messagePart: MixedTextTypedElement, i: number) => (
                        <span key={String(i)}>{renderMessagePart(messagePart)}</span>
                      ))}
                    <span className="readReceipts">
                      {readReceipts[message.timetoken] ? "Read By: " : ""}
                      {readReceipts[message.timetoken]?.map((rec) => (
                        <span key={users.find((user) => user.id === rec).name}>
                          {users.find((user) => user.id === rec).name},{" "}
                        </span>
                      ))}
                    </span>
                    <span className="messageReactions">
                      {message.reactions["👍"] && message.reactions["👍"].length != 0
                        ? `Reacted to by: `
                        : "Not reacted to"}
                      {removeDuplicateActions(message.reactions["👍"])?.map((rec) => (
                        <span key={rec.actionTimetoken}>
                          {users.find((user) => user.id === rec.uuid).name},{" "}
                        </span>
                      ))}
                    </span>
                  </p>
                  <button onClick={() => handleToggleReaction(message, "👍")}>
                    {message.hasUserReaction("👍") ? "Remove my reaction" : "React to this"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await markMessageRead(message)
                    }}
                  >
                    Mark Read
                  </button>
                </article>
              </li>
            )
          })}
        </ol>
      </section>

      <div className="typingIndicator">{typers}</div>
      <form className="message-input" onSubmit={handleSend}>
        <input
          type="text"
          value={text}
          onChange={(e) => {
            channel.startTyping()
            setText(e.target.value)
            handleInput(e)
          }}
          placeholder="Send message"
        />
        <input type="submit" value="➔" onClick={handleSend} style={{ color: text && "#de2440" }} />
      </form>
    </main>
  )
}
