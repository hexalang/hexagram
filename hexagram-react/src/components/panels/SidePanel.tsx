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

import React from 'react'
import { State } from '../../redux/store'
import * as TL from '../../tdlib/tdapi'
import { tg } from '../../tdlib/tdlib'
import { connect } from 'react-redux'
import { Dispatch, AnyAction } from 'redux'
import './SidePanel.scss'

const SidePanel = ({state, hideSidePanel, logOut}:{state: State, hideSidePanel: (e: unknown) => void, logOut: Function}) => {
	const user = state.users[state.myId]
	const name = user? (user.firstName + ' ' + user.lastName).trim() : 'Hexagram'
	const phone = '+' + (user? user.phone : '')

	const askLogout = () => {
		if (window.confirm("Log out?") == true) {
			logOut()
		}
	}

	return <div className="sidePanel">
		<div className="sideBar">
			<div className="sideInfo">
				<div className="sideInfoName">{name}</div>
				<div className="sideInfoName">{phone}</div>
			</div>
			<div className="button" onClick={_ => askLogout()}><span>Log out</span></div>
			<div className="button patreon" onClick={_ => window.open('https://www.patreon.com/PeyTy', '_blank')}><span>Patreon</span></div>
			<div className="button github" onClick={_ => window.open('https://github.com/hexalang/hexagram', '_blank')}><span>Source code on GitHub</span></div>
		</div>
		<div className="fade" onClick={hideSidePanel}>
		</div>
	</div>
}

const mapStateToProps = (state: State, ownProps: any) => ({ state })

function logOut() {
	return async (dispatch:Dispatch<AnyAction>, getState: () => State): Promise<void> => {
		await tg.logOut()
		setTimeout(() => {
			window.location.reload()
		}, 1000);
	}
}

const mapDispatchToProps = (dispatch:Dispatch) => {
	return {
		logOut: () => {
			return dispatch(logOut() as any as AnyAction)
		},
		hideSidePanel: (e: unknown) => {
			return dispatch({ type: 'SET_SIDEBAR_VISIBILITY', payload: { showSideBar: false } })
		},
	}
}

const SidePanelConnected = connect(mapStateToProps, mapDispatchToProps)(SidePanel)

export { SidePanelConnected as SidePanel }
