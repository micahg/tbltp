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

function sendFile(storeAPI: MiddlewareAPI, blob: File | URL, layer: string): Promise<AxiosResponse> {
  return new Promise((resolve, reject) => {

    let state: AppReducerState = storeAPI.getState();
    if (!state.environment.api) {
      return reject(`UNABLE TO GET API FROM STATE`);
    }
  
    let url: string = `${state.environment.api}/asset`;
    let formData = new FormData();
    let contentType: string = isFile(blob) ? blob.type : 'multipart/form-data';
    let content: Blob | string = isFile(blob) ? blob as Blob : blob.toString();
    formData.append('layer', layer);
    formData.append('image', content);
    axios.put(url, formData, { headers: { 'Content-Type': contentType }}).then(value => resolve(value))
      .catch(err => reject(err));
  });
}

export const ContentMiddleware: Middleware = storeAPI => next => action=> {
  switch (action.type) {
    case 'content/background':
      let load: URL | File = action.payload;
      sendFile(storeAPI, action.payload, 'background').then((value) => {
        let ts: number = (new Date()).getTime();
        action.payload = `${value.data.path}?${ts}`;
        return next(action);
      }).catch(err => console.error(`Unable to update overlay: ${JSON.stringify(err)}`));
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