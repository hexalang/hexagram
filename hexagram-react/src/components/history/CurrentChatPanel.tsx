// Hexagram
// Copyright (C) 2020  Oleg Petrenko
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import React, { useState, useEffect, useRef } from 'react'
import { state } from '../../mobx/store'
import * as TL from '../../tdlib/tdapi'
import { tg } from '../../tdlib/tdlib'
import { MessageSameSender, MessageSameSenderTheirs, CenterSystemMessage, MessagePhotoTheirs } from '../messages/MessageTypes'
import { StickerMy, StickerOnMessage, MessageMy, MessageTheirs, LottieSticker } from '../messages/MessageTypes'
import { Input } from './Input'
import { Top } from './Top'
import './CurrentChatPanel.scss'
import { observer } from 'mobx-react-lite'

const History = observer(() => {
	const [dragging, setDragging] = useState(false)
	const [position, setPosition] = useState(0)
	const [lastPosition, setLastPosition] = useState(0)
	const [progress, setProgress] = useState(0.0)

	const chatListScrollBar = useRef(null)
	const chatListScrollPane = useRef(null)

	const sliderMaxY = chatListScrollBar.current != null ? (chatListScrollBar.current as any).offsetHeight : 0
	const sliderHeight = 100 // TODO
	const sliderY = Math.min(Math.max(position, 0), sliderMaxY - sliderHeight)

	useEffect(() => {

		const onMouseMove = (e: any) => {
			const positionNew = Math.max(0, position + e.pageY - lastPosition)
			setPosition(positionNew)
			setLastPosition(e.pageY)

			const sliderMaxY = chatListScrollBar.current != null ? (chatListScrollBar.current as any).offsetHeight : 0
			const sliderY = Math.min(Math.max(positionNew, 0), sliderMaxY - sliderHeight)
			const progressNew = Math.min(sliderY / (sliderMaxY - sliderHeight), 1.0)
			setProgress(progressNew)
		}

		const onMouseUp = () => {
			setDragging(false)
		}

		if (dragging) {
			document.addEventListener('mousemove', onMouseMove)
			document.addEventListener('mouseup', onMouseUp)
		}

		return () => {
			document.removeEventListener('mousemove', onMouseMove)
			document.removeEventListener('mouseup', onMouseUp)
		}
	}, [dragging])

	const messages: React.ReactNode[] = []

	const chat = state.chats[state.currentChatId]

	const scrollToBottom = () => {
		// TODO remember scroll position for each chat separately
		setTimeout(() => {
			setProgress(Math.min(1.0, (1.0 - 0.00001) + Math.random() * 0.00001))
			const sliderMaxY = chatListScrollBar.current != null ? (chatListScrollBar.current as any).offsetHeight : 0
			setPosition(sliderMaxY - sliderHeight)
		}, 100)
	}

	useEffect(scrollToBottom, [chatListScrollPane.current, state.currentChatId, messages.length, chat && chat.lastMessage])

	useEffect(() => {
		if (
			chat &&
			(state.history[state.currentChatId] == null || state.history[state.currentChatId].length < 10)
		) {
			// Fix race condition
			const currentChatId = state.currentChatId
			// Avoid repeating of getChatHistory
			state.saveChatHistory(currentChatId, [])
			const howMuch = 25
			tg.getChatHistory(
				currentChatId,
				0, //chat.lastMessage,
				0,
				howMuch,
				false
			).then(messages => {
				tg.getChatHistory(
					currentChatId,
					0, //chat.lastMessage,
					0,
					howMuch,
					false
				).then(messages => {
					state.saveChatHistory(currentChatId, messages.messages)
				})
			})
		}
	}, [state.currentChatId])

	if (
		chat &&
		state.history[state.currentChatId] &&
		state.history[state.currentChatId].length > 0
	) {
		let destination = messages
		let lastSender = 0
		let lastMessageId = 0

		const mergeDestination = () => {
			if (lastSender === state.myId)
				messages.push(<MessageSameSender key={lastMessageId}>{destination}</MessageSameSender>)
			else if (lastSender === -1) // System message
				messages.push(<>{destination}</>)
			// Note: for channels and auto-forward from channels `lastSender == 0`!
			else messages.push(<MessageSameSenderTheirs
				senderUserId={lastSender}
				key={'~' + lastSender + '~' + state.currentChatId + '~' + lastMessageId}>
				{destination}
			</MessageSameSenderTheirs>
			)
		}

		const updateDestination = (senderUserId: number) => {
			if (destination === messages) {
				destination = []
				lastSender = senderUserId
			} else {
				if (lastSender !== senderUserId) {
					mergeDestination()
					destination = []
					lastSender = senderUserId
				}
			}
		}

		for (const messageId of [...state.history[state.currentChatId].slice().reverse()/*, chat.lastMessage*/]) {
			const messageState = state.messages[chat.id][messageId]
			if (messageState == null) continue
			const key = messageState.id
			lastMessageId = key
			const time = new Date(messageState.date * 1000).toLocaleTimeString(navigator.language, {
				hour: '2-digit',
				minute: '2-digit'
			})
			switch (messageState.content['@type']) {
				case "messageChatUpgradeFrom":
					let messageChatUpgradeFrom = messageState.content as TL.TLMessageChatUpgradeFrom
					updateDestination(-1)
					destination.push(<CenterSystemMessage key={key} text={`Group ${messageChatUpgradeFrom.title} upgraded to supergroup`} />)
					break

				case "messageChatJoinByLink":
					{
						updateDestination(-1)
						let messageChatJoinByLink = messageState.content as TL.TLMessageChatJoinByLink
						const senderName = state.users[messageState.senderUserId] ?
							(state.users[messageState.senderUserId].firstName + ' ' + state.users[messageState.senderUserId].lastName).trim()
							: 'User'
						const text = `${senderName} joined the group via invite link`
						destination.push(<CenterSystemMessage key={key} text={text} />)
					}
					break

				case "messagePhoto":
					{
						const messagePhoto = messageState.content as TL.TLMessagePhoto
						const photo = messagePhoto.photo
						const caption: TL.TLFormattedText = messagePhoto.caption
						const text = caption.text !== "" ? [<div className="text">{caption.text}</div>] : []
						const sized: TL.TLFile = photo.sizes.reduce((prev, curr) => prev.height > curr.height ? prev : curr).photo
						updateDestination(messageState.senderUserId)
						const senderName = destination.length === 0 && state.users[messageState.senderUserId] ? state.users[messageState.senderUserId].firstName : null
						destination.push(<MessagePhotoTheirs key={key} sized={sized} author={senderName} text={text} time={time} date={messageState.date} />)
					}
					break

				case "messageSticker":
					{
						const messageSticker = (messageState.content as TL.TLMessageSticker)

						if (messageSticker.sticker.is_animated) {
							const sticker: TL.TLFile = messageSticker.sticker.sticker
							updateDestination(messageState.senderUserId)
							destination.push(<LottieSticker key={key} sticker={sticker} time={time} />)

						} else {

							const sticker: TL.TLFile = messageSticker.sticker.is_animated ? messageSticker.sticker.thumbnail.file : messageSticker.sticker.sticker
							updateDestination(messageState.senderUserId)
							destination.push(<StickerMy key={key} sticker={sticker} time={time} />)
						}
					}
					break

				case "messageText":
					updateDestination(messageState.senderUserId)

					// TODO no sender name for private chats
					const senderName = destination.length === 0 && state.users[messageState.senderUserId] ? state.users[messageState.senderUserId].firstName : null
					let lines = (messageState.content as TL.TLMessageText).text.text//.trim()
					let text = [<div className="text">{lines}</div>]

					if (lines.includes('\n')) {
						text = []
						const parts = lines.split('\n')

						for (let line of parts) {
							let className = "text"

							if (text.length !== (parts.length - 1)) {
								className = "text textLine"
							}

							if (line === '') {
								line = <>&nbsp;</> as any
							}

							const what = <div className={className}>{line}</div>
							text.push(what)
						}
					}

					if ((messageState.content as TL.TLMessageText).text.entities.length > 0) {
						let lastOffset = 0
						let lastLength = 0
						text = []
						for (const entity of (messageState.content as TL.TLMessageText).text.entities) {
							if (entity.offset > lastOffset + lastLength) {
								const string = lines.substr(lastOffset + lastLength, entity.offset - (lastOffset + lastLength))
								const what = <div key={lastOffset} className="text">{'' + string + ''}</div>
								text.push(what)
							}

							lastOffset = entity.offset
							lastLength = entity.length
							const string = lines.substr(entity.offset, entity.length)

							switch (entity.type["@type"]) {
								case 'textEntityTypeBold': {
									const what = <div key={lastOffset} className="text textEntityTypeBold">{'' + string + ''}</div>
									text.push(what)
									break
								}

								case 'textEntityTypeItalic': {
									const what = <div key={lastOffset} className="text textEntityTypeItalic">{'' + string + ''}</div>
									text.push(what)
									break
								}

								case 'textEntityTypeCode': {
									const what = <div key={lastOffset} className="text textEntityTypeCode">{'' + string + ''}</div>
									text.push(what)
									break
								}

								case 'textEntityTypeStrikethrough': {
									const what = <div key={lastOffset} className="text textEntityTypeStrikethrough">{'' + string + ''}</div>
									text.push(what)
									break
								}

								case 'textEntityTypeUnderline': {
									const what = <div key={lastOffset} className="text textEntityTypeUnderline">{'' + string + ''}</div>
									text.push(what)
									break
								}

								case 'textEntityTypeUrl': {
									const href = string
									const what = <div onClick={_ => window.open(href, '_blank')} title={href} key={lastOffset} className="text textEntityTypeUrl">{'' + string + ''}</div>
									text.push(what)
									break
								}

								case 'textEntityTypeTextUrl': {
									const textEntityTypeTextUrl = (entity.type as TL.TLTextEntityTypeTextUrl)
									const href = textEntityTypeTextUrl.url
									const what = <div onClick={_ => window.open(href, '_blank')} title={href} key={lastOffset} className="text textEntityTypeUrl">{'' + string + ''}</div>
									text.push(what)
									break
								}

								case 'textEntityTypeMention': {
									const href = 'https://t.me/' + string.substr(1)
									const what = <div onClick={_ => window.open(href, '_blank')} title={href} key={lastOffset} className="text textEntityTypeUrl">{'' + string + ''}</div>
									text.push(what)
									break
								}

								case 'textEntityTypeHashtag': {
									const href = 'https://t.me/TODO_' + string // TODO
									const what = <div onClick={_ => window.open(href, '_blank')} title={href} key={lastOffset} className="text textEntityTypeUrl">{'' + string + ''}</div>
									text.push(what)
									break
								}

								case 'textEntityTypeCashtag': {
									const href = 'https://t.me/TODO_' + string // TODO
									const what = <div onClick={_ => window.open(href, '_blank')} title={href} key={lastOffset} className="text textEntityTypeUrl">{'' + string + ''}</div>
									text.push(what)
									break
								}

								case 'textEntityTypeBotCommand': {
									const href = 'https://t.me/TODO_' + string // TODO
									const what = <div onClick={_ => window.open(href, '_blank')} title={href} key={lastOffset} className="text textEntityTypeUrl">{'' + string + ''}</div>
									text.push(what)
									break
								}

								case 'textEntityTypeEmailAddress': {
									const href = 'mailto:' + string
									const what = <div onClick={_ => window.open(href, '_blank')} title={href} key={lastOffset} className="text textEntityTypeUrl">{'' + string + ''}</div>
									text.push(what)
									break
								}

								case 'textEntityTypePhoneNumber': {
									const href = 'tel:' + string
									const what = <div onClick={_ => window.open(href, '_blank')} title={href} key={lastOffset} className="text textEntityTypeUrl">{'' + string + ''}</div>
									text.push(what)
									break
								}

								default: {
									const what = <div className="text">{'(?' + entity.type["@type"] + '=' + string + '?)'}</div>
									text.push(what)
								}
							}
						}

						if (lastOffset + lastLength !== lines.length) {
							const string = lines.substr(lastOffset + lastLength)
							const what = <div key={lastOffset} className="text">{'' + string + ''}</div>
							text.push(what)
						}
					}

					const reactions = []
					for (const messageId of state.history[chat.id]) {
						const message = state.messages[chat.id][messageId]
						if (message.replyToMessageId === messageState.id && message.content['@type'] === "messageSticker") {
							const messageSticker = (message.content as TL.TLMessageSticker)
							const sticker: TL.TLFile = messageSticker.sticker.thumbnail.file
							const senderName = state.users[message.senderUserId] ? state.users[message.senderUserId].firstName : 'Someone'

							reactions.push(<StickerOnMessage senderName={senderName} key={key} sticker={sticker} />)
						}
					}

					destination.push(
						lastSender === state.myId ?
							<MessageMy key={key} text={text} time={time} date={messageState.date} reactions={reactions} />
							:
							<MessageTheirs key={key} author={senderName} text={text} time={time} date={messageState.date} reactions={reactions} />
					)

					break

				default:
					console.log(`Unsupported message history type ${messageState.content['@type']}`)
					destination.push(<CenterSystemMessage key={key} text={`Unsupported message type ${messageState.content['@type']}`} />)
					break
			}
		}

		if (destination !== messages && destination.length > 0) mergeDestination()
	}

	const onMouseDown = (e: any) => {
		setLastPosition(e.pageY)
		setDragging(true)
		e.stopPropagation()
	}

	const onMouseClick = (e: any) => {
	}

	const onWheel = (e: any) => {
		// e.deltaY is -100 ... 100
		const progressNew = progress + e.deltaY * 0.01 * 0.085
		const progressClamp = Math.max(Math.min(1.0, progressNew), 0.0)
		setProgress(progressClamp)

		const sliderMaxY = chatListScrollBar.current != null ? (chatListScrollBar.current as any).offsetHeight : 0
		const sliderY = (sliderMaxY - sliderHeight) * progressClamp
		setPosition(sliderY)
		setLastPosition(sliderY)
	}

	const _progress = progress
	const paneH = chatListScrollPane.current != null ? (chatListScrollPane.current as any).offsetHeight : 0
	const paneY = -Math.round(_progress * (paneH - sliderMaxY))

	// TODO use return (<>) everywhere
	return (
		<div className="history" key={state.currentChatId}>
			<div className="historyView" onWheel={onWheel} key={state.currentChatId} ref={chatListScrollPane} style={{ top: paneY + 'px' }}>
				{messages}
			</div>
			<div className="chatListScrollBar" onWheel={onWheel} onMouseDown={onMouseClick} ref={chatListScrollBar}></div>
			<div className="chatListScrollBarSlider" onWheel={onWheel} onMouseDown={onMouseDown} style={{ top: sliderY + 3 + 'px' }}></div>
		</div>
	)
})

export const CurrentChatPanel = observer(() => {
	const chatSelected = state.chats[state.currentChatId] && state.chatIds.includes(state.currentChatId)

	return (
		<>
			<div className="blow center">
				{
					// TODO handle status . left the group
					chatSelected ?
						<>
							<Top />
							<History />
							<Input />
						</>
						:
						<>
							<div className="pleaseSelectChat "><div>Please select a chat to start messaging</div></div>
							<div className="pleaseSelectChat "><a href="https://www.patreon.com/PeyTy">Made for you by PeyTy</a></div>
						</>
				}
			</div>
		</>
	)
})
