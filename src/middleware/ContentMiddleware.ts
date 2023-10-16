import { Middleware } from 'redux';
import axios, { AxiosResponse } from 'axios';
import { AppReducerState } from '../reducers/AppReducer';
import { getToken } from '../utils/auth';
import { Scene } from '../reducers/ContentReducer';

function isBlob(payload: URL | Blob): payload is File {
  return (payload as Blob).type !== undefined;
}

function sendFile(state: AppReducerState, blob: File | URL, layer: string): Promise<AxiosResponse> {
  return new Promise((resolve, reject) => {
    if (!state.content.currentScene) return reject('No scene selected');
    let scene: Scene = state.content.currentScene;
    let url: string = `${state.environment.api}/scene/${scene._id}/content`;
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
      const scene: Scene = state.content.currentScene;
      if (!scene) return next(action);
      const url: string = `${state.environment.api}/state`;
      getToken(state)
        .then(headers => axios.put(url, {scene: scene._id}, {headers: headers}))
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
        const ts: number = (new Date()).getTime();
        const scene: Scene = value.data;
        scene.tableContent = `${scene.tableContent}?${ts}`
        return next({type: 'content/scene', payload: scene})
      }).catch(err => console.error(`Unable to update overlay: ${JSON.stringify(err)}`));
      break;
    case 'overlay':
      // undefined means we're wiping the canvas... probably a new background
      if (action.payload === undefined) return next(action);

      // if we have an overlay payload then send it
      sendFile(state, action.payload, 'overlay')
        .then((value) => next({type: 'content/scene', payload: value.data}))
        .catch(err => console.error(`Unable to update overlay: ${JSON.stringify(err)}`));
      break;
    case 'zoom': {
      if (action.payload === undefined) return;
      const scene = state.content.currentScene;
      if (!scene) return next(action);
      const url: string = `${state.environment.api}/scene/${scene._id}/viewport`;
      getToken(state)
        .then(headers => axios.put(url, action.payload, {headers: headers}))
        .then(value => next({type: 'content/scene', payload: value.data}))
        .catch(err => console.error(`Unable to update viewport: ${JSON.stringify(err)}`));
      break;
    }
    case 'scenes': {
      const url: string = `${state.environment.api}/scene`;
      getToken(state)
        .then(headers => axios.get(url, {headers: headers}))
        .then(value => next({type: action.type, payload: value.data}))
        .catch(err => console.error(`Unable to fetch scenes: ${JSON.stringify(err)}`));
      break;
    }
    default:
      next(action);
      break;
  }
}