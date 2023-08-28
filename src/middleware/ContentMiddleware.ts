import { Middleware } from 'redux';
import axios, { AxiosResponse } from 'axios';
import { AppReducerState } from '../reducers/AppReducer';
import { getToken } from '../utils/auth';

function isBlob(payload: URL | Blob): payload is File {
  return (payload as Blob).type !== undefined;
}

function sendFile(state: AppReducerState, blob: File | URL, layer: string): Promise<AxiosResponse> {
  return new Promise((resolve, reject) => {

    let url: string = `${state.environment.api}/asset`;
    let formData = new FormData();
    let contentType: string = isBlob(blob) ? blob.type : 'multipart/form-data';
    let content: Blob | string = isBlob(blob) ? blob as Blob : blob.toString();
    formData.append('layer', layer);
    formData.append('image', content);

    getToken(state, {'Content-Type': contentType})
      .then(headers => axios.put(url, formData, { headers: headers}))
      .then(value => resolve(value))
      .catch(err => reject(err));
  });
}

export const ContentMiddleware: Middleware = storeAPI => next => action=> {

  // only care about content
  if (!(action.type as string).startsWith('content/')) return next(action);

  const actionType: string = (action.type as string).substring(8);
  const state = storeAPI.getState();
  if (!state.environment.api) {
    console.error('No API URL in environment state.')
    return next(action);
  }

  switch (actionType) {
    case 'push': {
      const url: string = `${state.environment.api}/state`;
      getToken(state)
        // why PUT {}? data is already up, just signaling sync to table
        .then(headers => axios.put(url, {}, {headers: headers}))
        .then(() => {
          action.payload = (new Date()).getTime();
          next(action);  
        }).catch(err => {
          // TODO MICAH DISPLAY ERROR
          console.error(`Unable to update state: ${JSON.stringify(err)}`);
          next(action);
        });
    }
      break;
    case 'pull': {
      const url: string = `${state.environment.api}/state`;
      getToken(state)
        .then(headers => axios.get(url, {headers: headers}))
        .then(value => next({...action, payload: value.data}))
        .catch(err => {
          // TODO MICAH display error
          console.error(`Unable to get state: ${JSON.stringify(err)}`);
        });
    }
    break;
    case 'background':
      sendFile(state, action.payload, 'background').then((value) => {
        let ts: number = (new Date()).getTime();
        action.payload = `${value.data.path}?${ts}`;
        return next(action);
      }).catch(err => console.error(`Unable to update overlay: ${JSON.stringify(err)}`));
      break;
    case 'overlay':
      // undefined means we're wiping the canvas... probably a new background
      if (action.payload === undefined) return next(action);

      // if we have an overlay payload then send it
      sendFile(state, action.payload, 'overlay').then((value) => {
        return next(action);
      }).catch(err => console.error(`Unable to update overlay: ${JSON.stringify(err)}`));
      break;
    case 'zoom': {
      if (action.payload === undefined) return;
      const url: string = `${state.environment.api}/viewport`;
      getToken(state)
        .then(headers => axios.put(url, action.payload, {headers: headers}))
        .then(value => {
          action.payload = value.data;
          next(action);
        })
        .catch(err => console.error(`Unable to update viewport: ${JSON.stringify(err)}`));
      break;
    }
    default:
      next(action);
      break;
  }
}