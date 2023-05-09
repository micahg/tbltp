import { PayloadAction } from "@reduxjs/toolkit";

export type EnvironmentReducerState = {
	readonly api: string |undefined;
};

const initialState: EnvironmentReducerState = {
	api: undefined,
}

export const EnvironmentReducer = (state = initialState, action: PayloadAction) => {
	switch(action.type) {
		case 'environment/config': {
			if (action.payload != null && ('data' in action.payload)) {
				if ('API_URL' in action.payload['data']) {
					return {...state, api: action.payload['data']['API_URL']}
				}
			}
			return state;
		}
		default:
			return state;
	}
}