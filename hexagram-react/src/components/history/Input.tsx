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

import { observer } from 'mobx-react-lite'
import { useState, useEffect, useRef } from 'react'
import { state } from '../../mobx/store'
import * as TL from '../../tdlib/tdapi'
import { tg } from '../../tdlib/tdlib'
import './Input.scss'

const replaceCaret = (el: HTMLElement) => {
	// Place the caret at the end of the element
	const target = document.createTextNode('')
	el.appendChild(target)
	// do not move caret if element was not focused
	const isTargetFocused = document.activeElement === el
	if (target !== null && target.nodeValue !== null && isTargetFocused) {
		const sel = window.getSelection()
		if (sel !== null) {
			const range = document.createRange()
			range.setStart(target, target.nodeValue.length)
			range.collapse(true)
			sel.removeAllRanges()
			sel.addRange(range)
		}
		if (el instanceof HTMLElement) el.focus()
	}
}

export const Input = observer(() => {
	const [value, setValue] = useState('')
	const messagesEndRef = useRef(null)

	useEffect(() => {
		const current = messagesEndRef.current
		if (current) replaceCaret(current)
	})

	useEffect(() => {
		const chat = state.chats[state.currentChatId]
		// Get draft
		const draft = chat && chat.draft
		if (
			draft &&
			draft['@type'] === 'inputMessageText' &&
			(draft as TL.TLInputMessageText).text['@type'] === 'formattedText'
		) {
			setValue(draftText.trim())
		} else setValue('')
			const draftText: string = ((draft as TL.TLInputMessageText).text as TL.TLFormattedText).text

	}, [state.currentChatId])

	const updateValue = (text: string) => {
		setValue(text)
	}

	const onKeyDown = (e: any) => {
		if (e.key === 'Enter') {
			tg.parseTextEntities(
				value,
				{ '@type': 'textParseModeMarkdown', version: 1 }
			).then(text => {
				tg.sendMessage(
					state.currentChatId, // chat_id
					0, // message_thread_id
					0, // reply_to_message_id
					{
						"@type": "messageSendOptions",
						disable_notification: false,
						from_background: false,
						scheduling_state: null as any
					}, // options
					null as any,// reply_markup
					{
						'@type': 'inputMessageText',
						text: text,
						disable_web_page_preview: false,
						clear_draft: true
					}// input_message_content
				)
			})

			setValue('')
			e.preventDefault()
			return false
		}
	}

	const chat = state.chats[state.currentChatId]

	if (chat == null) return null

	if (
		chat.type['@type'] === 'chatTypePrivate' &&
		state.users[(chat.type as TL.TLChatTypePrivate).user_id] &&
		state.users[(chat.type as TL.TLChatTypePrivate).user_id].type['@type'] === 'userTypeDeleted'
	) {
		return null
	}

	if (
		chat.type['@type'] === 'chatTypeSupergroup' &&
		state.supergroups[(chat.type as TL.TLChatTypeSupergroup).supergroup_id]
	) {
		const supergroup = state.supergroups[(chat.type as TL.TLChatTypeSupergroup).supergroup_id]
		if (supergroup.isChannel === true) return null
	}

	return (
		<div className="bottom">
			<div className="input">
				{(value === '') && false && <div className="placeholder">Write a message...</div>}
				{false &&
					<div ref={messagesEndRef} className="editor" contentEditable={true} onKeyDown={onKeyDown} onInput={e => updateValue((e.target as any).innerHTML)} dangerouslySetInnerHTML={{ __html: value }}></div>
				}
				<input type="text" className="editor" id="textName" maxLength={90} placeholder="Write a message..." onKeyDown={onKeyDown} value={value} onChange={e => updateValue(e.target.value)} required />
			</div>

			<div className="thinVerticalLine" />
		</div>
	)
})
