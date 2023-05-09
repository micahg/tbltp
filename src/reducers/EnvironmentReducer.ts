import { PayloadAction } from "@reduxjs/toolkit";

export type EnvironmentReducerState = {
  readonly api: string | undefined;
  readonly ws: string | undefined;
};

const initialState: EnvironmentReducerState = {
  api: undefined,
  ws: undefined,
}

export const EnvironmentReducer = (state = initialState, action: PayloadAction) => {
	switch(action.type) {
		case 'environment/config': {
			if (action.payload != null && ('data' in action.payload)) {
				if ('API_URL' in action.payload['data'] && 'WS_URL' in action.payload['data']) {
					return {...state, api: action.payload['data']['API_URL'], ws: action.payload['data']['WS_URL']}
				} else {
          console.error(`environment/config payload missing API_URL or WS_URL`);
        }
			}
			return state;
		}
		default:
			return state;
	}
}