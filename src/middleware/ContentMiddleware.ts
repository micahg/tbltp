import { Middleware, MiddlewareAPI, StateFromReducersMapObject } from 'redux';
import axios, { AxiosResponse } from 'axios';
import { blob } from 'stream/consumers';
import { AppReducerState } from '../reducers/AppReducer';
import { rejects } from 'assert';

function isURL(payload: URL | File): payload is URL {
  return (payload as URL).host !== undefined;
}

function isFile(payload: URL | File): payload is File {
  return (payload as File).lastModified !== undefined;
}

function sendFile(storeAPI: MiddlewareAPI, blob: Blob, layer: string): Promise<AxiosResponse> {
  return new Promise((resolve, reject) => {

    let state: AppReducerState = storeAPI.getState();
    if (!state.environment.api) {
      return reject(`UNABLE TO GET API FROM STATE`);
    }
  
    let url: string = `${state.environment.api}/asset`;
    let formData = new FormData();
    formData.append('layer', layer);
    formData.append('image', blob);
    axios.put(url, formData, { headers: { 'Content-Type': blob.type }}).then(value => resolve(value))
      .catch(err => reject(err));
  });
}

export const ContentMiddleware: Middleware = storeAPI => next => action=> {
  switch (action.type) {
    case 'content/background':
      let load: URL | File = action.payload;
      if (isURL(load)) {
        console.log('URL');
      } else if (isFile(load)) {
        sendFile(storeAPI, action.payload, 'background').then((value) => {
          let ts: number = (new Date()).getTime();
          action.payload = `${value.data.path}?${ts}`;
          return next(action);
        }).catch(err => console.error(`Unable to update overlay: ${JSON.stringify(err)}`));
      } else {
        console.error('Incompatible payload for content/background middleware');
        return;
      }
      return;
    case 'content/overlay':
      sendFile(storeAPI, action.payload, 'overlay').then((value) => {
        console.log(`I did send ${JSON.stringify(value)}`);
        return next(action);
      }).catch(err => console.error(`Unable to update overlay: ${JSON.stringify(err)}`));
      break;
    default:
      next(action);
      break;
  }
}