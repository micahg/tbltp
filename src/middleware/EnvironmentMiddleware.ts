import { Middleware } from 'redux';
import axios from 'axios';

export const EnvironmentMiddleware: Middleware = storeAPI => next => action => {
    if (action.type === 'environment/config') {
        console.log(`Requesting config`);
        axios.get('/env.json').then(data => {
            action.payload = data;
            return next(action);
        }).catch(reason => {
            // TODO trigger an error
            console.error(`FAILED TO FETCH ${JSON.stringify(reason)}`)
        });
    } else {
        return next(action);
    }
}