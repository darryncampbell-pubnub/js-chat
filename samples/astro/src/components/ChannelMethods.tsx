import { useState, useRef } from "react"
import { useStore } from "@nanostores/react"
import { chatAtom } from "../store"
import { extractErrorMessage } from "./helpers"
import { Channel } from "@pubnub/chat"

type GetAllState = {
  channels: Channel[]
  total: number
  page: { next?: string; prev?: string }
}

const defaultGetAllState = {
  channels: [],
  total: 0,
  page: { next: undefined, prev: undefined },
}

export default function () {
  const chat = useStore(chatAtom)
  const [createForm, setCreateForm] = useState({ id: "", name: "" })
  const [updateForm, setUpdateForm] = useState({ id: "", name: "", description: "", status: "" })
  const [presence, setPresence] = useState<string[]>([])
  const [channel, setChannel] = useState<Channel>()
  const [getAllState, setGetAllState] = useState<GetAllState>(defaultGetAllState)
  const getAllRef = useRef(defaultGetAllState)
  const [input, setInput] = useState("")
  const [textInput, setTextInput] = useState("")
  const [typingUserIds, setTypingUserIds] = useState<string[]>([])
  const [error, setError] = useState("")

  async function handleCreate() {
    try {
      const channel = await chat.createChannel(createForm.id, { name: createForm.name })
      setCreateForm({ id: "", name: "" })
      setChannel(channel)
    } catch (e: any) {
      setError(extractErrorMessage(e))
      console.error(e)
    }
  }

  async function handleUpdate() {
    try {
      const { name, description, status } = updateForm
      const channel = await chat.updateChannel(updateForm.id, { name, description, status })
      setUpdateForm({ id: "", name: "", description: "", status: "" })
      setChannel(channel)
    } catch (e: any) {
      setError(extractErrorMessage(e))
      console.error(e)
    }
  }

  async function handleGet() {
    try {
      const channel = await chat.getChannel(input)
      setUpdateForm({ ...channel })
      channel?.getTyping((userIds) => setTypingUserIds(userIds))
      setChannel(channel)
    } catch (e: any) {
      setError(extractErrorMessage(e))
      console.error(e)
    }
  }

  async function handleGetAll() {
    try {
      do {
        const { channels, page, total } = await chat.getChannels({
          limit: 2,
          page: getAllRef.current.page,
        })
        getAllRef.current = {
          channels: [...getAllRef.current.channels, ...channels],
          page,
          total,
        }
      } while (getAllRef.current.channels.length < getAllRef.current.total)
      setGetAllState(getAllRef.current)
    } catch (e: any) {
      setError(extractErrorMessage(e))
      console.error(e)
    }
  }

  async function handleHardDelete() {
    try {
      if (!channel) return
      await channel.delete()
      setUpdateForm({ id: "", name: "", description: "", status: "" })
      setChannel(undefined)
    } catch (e: any) {
      setError(extractErrorMessage(e))
      console.error(e)
    }
  }

  async function handleSoftDelete() {
    try {
      if (!channel) return
      await channel.delete({ soft: true })
      setUpdateForm({ id: "", name: "", description: "", status: "" })
      setChannel(undefined)
    } catch (e: any) {
      setError(extractErrorMessage(e))
      console.error(e)
    }
  }

  async function handleGetPresence() {
    try {
      const ids = await channel?.whoIsPresent(input)
      setPresence(ids)
    } catch (e: any) {
      setError(extractErrorMessage(e))
      console.error(e)
    }
  }

  async function handleTextInput(e) {
    const newText = e.target.value
    setTextInput(newText)
    if (newText) await channel?.startTyping()
    else await channel?.stopTyping()
  }

  return (
    <>
      {error ? <p className="error my-4">{error}</p> : null}

      <div className="grid lg:grid-cols-2 gap-8 mt-6">
        <section>
          <h3>Get all channels</h3>
          <button className="mb-4" onClick={handleGetAll}>
            Get all channels
          </button>
          {getAllState.channels.length ? (
            <div>
              <p>
                <b>Total count: </b>
                {getAllState.total}
              </p>
              <p>
                <b>Existing Channels: </b>
                {getAllState.channels.map((c) => c.id).join(", ")}
              </p>
            </div>
          ) : null}
        </section>

        <section>
          <h3>Create channel</h3>
          <label htmlFor="getChannel">Channel ID</label>
          <input
            type="text"
            name="getChannel"
            value={createForm.id}
            onChange={(e) => setCreateForm((f) => ({ ...f, id: e.target.value }))}
          />
          <label htmlFor="getChannel">Name</label>
          <input
            type="text"
            name="getChannel"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
          />
          <button className="float-right mt-3" onClick={handleCreate}>
            Create channel
          </button>
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 mt-6">
        <section>
          <h3>Get channel</h3>
          <label htmlFor="getChannel">Channel ID</label>
          <input
            type="text"
            name="getChannel"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="float-right mt-3" onClick={handleGet}>
            Get channel
          </button>
        </section>

        {channel ? (
          <section>
            <h3>Update channel</h3>
            <label htmlFor="update-id">Channel ID</label>
            <input
              type="text"
              name="update-id"
              value={updateForm.id}
              onChange={(e) => setUpdateForm((f) => ({ ...f, id: e.target.value }))}
            />
            <label htmlFor="update-name">Name</label>
            <input
              type="text"
              name="update-name"
              value={updateForm.name}
              onChange={(e) => setUpdateForm((f) => ({ ...f, name: e.target.value }))}
            />
            <label htmlFor="update-desc">Description</label>
            <input
              type="text"
              name="update-desc"
              value={updateForm.description}
              onChange={(e) => setUpdateForm((f) => ({ ...f, description: e.target.value }))}
            />
            <label htmlFor="update-status">Status</label>
            <input
              type="text"
              name="update-status"
              value={updateForm.status}
              onChange={(e) => setUpdateForm((f) => ({ ...f, status: e.target.value }))}
            />
            <nav className="float-right mt-3">
              <button className="mr-2" onClick={handleHardDelete}>
                Hard delete channel
              </button>
              <button className="mr-2" onClick={handleSoftDelete}>
                Soft delete channel
              </button>
              <button onClick={handleUpdate}>Update channel</button>
            </nav>
          </section>
        ) : null}
      </div>

      {channel ? (
        <>
          <div className="grid lg:grid-cols-2 gap-8 mt-6">
            <section>
              <h3>Channel presence</h3>
              <button className="mb-3" onClick={handleGetPresence}>
                Get channel presence
              </button>
              <p>
                <b>Channel presence: </b>
                {presence.join(", ")}
              </p>
            </section>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mt-6">
            <section>
              <h3>Sending text messages</h3>
              <label htmlFor="sendText">Type a message</label>
              <input type="text" name="sendText" value={textInput} onChange={handleTextInput} />
            </section>

            <section>
              <h3>Typing indicators</h3>
              <p>
                <b>Currently typing user ids: </b>
                {typingUserIds.join(", ")}
              </p>
            </section>
          </div>
        </>
      ) : (
        <p className="mt-6">Get a channel to unlock additional features</p>
      )}
    </>
  )
}