import { Middleware } from 'redux';
import axios, { AxiosResponse } from 'axios';
import { AppReducerState } from '../reducers/AppReducer';
import { getToken } from '../utils/auth';
import { Scene } from '../reducers/ContentReducer';

export interface NewSceneBundle {
  description: string,
  player: File,
  detail?: File,
}

function isBlob(payload: URL | Blob): payload is File {
  return (payload as Blob).type !== undefined;
}

  function sendFile(state: AppReducerState, scene: Scene, blob: File | URL, layer: string): Promise<AxiosResponse> {
  return new Promise((resolve, reject) => {
    const url = `${state.environment.api}/scene/${scene._id}/content`;
    const formData = new FormData();
    const contentType: string = isBlob(blob) ? blob.type : 'multipart/form-data';
    const content: Blob | string = isBlob(blob) ? blob as Blob : blob.toString();
    formData.append('layer', layer);
    formData.append('image', content);

    getToken(state, {'Content-Type': contentType})
      .then(headers => axios.put(url, formData, { headers: headers}))
      .then(value => resolve(value))
      .catch(err => reject(err));
  });
}

export const ContentMiddleware: Middleware = storeAPI => next => action=> {

  const state = storeAPI.getState();
  if (!state.environment.api) {
    console.error('No API URL in environment state.')
    return next(action);
  }

  switch (action.type) {
    case 'content/push': {
      const scene: Scene = state.content.currentScene;
      if (!scene) return next(action);
      const url = `${state.environment.api}/state`;
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
    case 'content/pull': {
      const url = `${state.environment.api}/state`;
      getToken(state)
        .then(headers => axios.get(url, {headers: headers}))
        .then(value => next({...action, payload: value.data}))
        .catch(err => {
          // TODO MICAH display error
          console.error(`Unable to get state: ${JSON.stringify(err)}`);
        });
    }
    break;
    // case 'content/player':{
    //   const scene: Scene = state.content.currentScene;
    //   sendFile(state, scene, action.payload, 'background').then((value) => {
    //     // const ts: number = (new Date()).getTime();
    //     // const scene: Scene = value.data;
    //     // scene.playerContent = `${scene.playerContent}?${ts}`
    //     return next({type: 'content/scene', payload: scene})
    //   }).catch(err => console.error(`Unable to update overlay: ${JSON.stringify(err)}`));
    //   break;
    // }
    case 'content/player':
    case 'content/detail':
    case 'content/overlay': {
      // undefined means we're wiping the canvas... probably a new background
      if (action.payload === undefined) return next(action);

      const scene: Scene = state.content.currentScene;
      // if we have an overlay payload then send it
      sendFile(state, scene, action.payload, action.type.split('/')[1])
        .then((value) => next({type: 'content/scene', payload: value.data}))
        .catch(err => console.error(`Unable to update overlay: ${JSON.stringify(err)}`));
      break;
    }
    case 'content/zoom': {
      if (action.payload === undefined) return;
      const scene = state.content.currentScene;
      if (!scene) return next(action);
      const url = `${state.environment.api}/scene/${scene._id}/viewport`;
      getToken(state)
        .then(headers => axios.put(url, action.payload, {headers: headers}))
        .then(value => next({type: 'content/scene', payload: value.data}))
        .catch(err => console.error(`Unable to update viewport: ${JSON.stringify(err)}`));
      break;
    }
    case 'content/scenes': {
      const url = `${state.environment.api}/scene`;
      getToken(state)
        .then(headers => axios.get(url, {headers: headers}))
        .then(value => next({type: action.type, payload: value.data}))
        .catch(err => console.error(`Unable to fetch scenes: ${JSON.stringify(err)}`));
      break;
    }
    case 'content/createscene': {
      const url = `${state.environment.api}/scene`;
      const bundle: NewSceneBundle = action.payload;
      getToken(state)
        .then(headers => axios.put(url, bundle, {headers: headers}))
        .then(data => {
          next({type: 'content/scene', payload: data.data});
          return sendFile(state, data.data, bundle.player, 'player');
        })
        .then(data => {
          if (!bundle.detail) return data; // skip if there is no detailed view
          next({type: 'content/scene', payload: data.data});
          return sendFile(state, data.data, bundle.detail, 'detail');
        })
        .then(data => next({type: 'content/scene', payload: data.data}));
      break;
    }
    case 'content/deletescene': {
      const url = `${state.environment.api}/scene/${action.payload._id}`;
      getToken(state)
        .then(headers => axios.delete(url, {headers: headers}))
        .then(() => next(action))
        .catch(err => console.error(`Unable to delet scene: ${JSON.stringify(err)}`));
      break;
    }
    default:
      next(action);
      break;
  }
}