process.env['DISABLE_AUTH'] = "true";
import { app, serverPromise, shutDown, startUp} from '../src/server' ;
import * as request from 'supertest';
import {afterAll, beforeEach, beforeAll, describe, it, expect, jest} from '@jest/globals';
import { getFakeUser, getOAuthPublicKey } from '../src/utils/auth';

import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { userZero, userOne } from './assets/auth';
const WebSocketClient = require('websocket').client;

let mongodb: MongoMemoryServer;
let mongocl: MongoClient;

jest.mock('../src/utils/auth');

beforeAll(done => {
  // mongo 7 needs wild tiger
  MongoMemoryServer.create({instance: {storageEngine: 'wiredTiger'}}).then(mongo => {
    mongodb = mongo;
    process.env['MONGO_URL'] = `${mongo.getUri()}ntt`;
    mongocl = new MongoClient(process.env['MONGO_URL']);

    (getOAuthPublicKey as jest.Mock).mockReturnValue(Promise.resolve('pubkey'));

    startUp();
    serverPromise
      .then(() => done())
      .catch(err => {
        console.error(`Getting server failed: ${JSON.stringify(err)}`);
        process.exit(1);
      }
    );
  });
});

afterAll(() => {
  shutDown('SIGJEST')                         // signal shutdown
  mongocl.close().then(() => mongodb.stop()); // close client then db
});


describe("scene", () => {
  // start each test with the zero user as the calling user
  beforeEach(() => {
    (getFakeUser as jest.Mock).mockReturnValue(userZero);
  });

  it("Should close without data for an unknown user", (done) => {
    const client = new WebSocketClient();
    client.on('connect', conn => {
      conn.on('message', msg => {
        throw new Error(`Received data when we should have closed: ${JSON.stringify(msg)}`);
      });
      conn.on('close', () => done());
      conn.on('error', () => {
        throw new Error('Socket error when it should have closed');
      });
    });
    client.connect('ws://localhost:3000?bearer=asdf', 'echo-protocol');
  });

  it("Should create scenes", async () => {
    const sceneOneId = (await request(app).get('/scene')).body[0]._id;
    await request(app).put('/state').send({scene: sceneOneId});
    await request(app).put(`/scene/${sceneOneId}/content`).field('layer', 'background').attach('image', 'test/assets/1x1.png');

    (getFakeUser as jest.Mock).mockReturnValue(userOne);

    const sceneTwoId = (await request(app).get('/scene')).body[0]._id;
    await request(app).put('/state').send({scene: sceneTwoId});
    await request(app).put(`/scene/${sceneTwoId}/content`).field('layer', 'background').attach('image', 'test/assets/1x1.png');

    expect(sceneOneId).not.toBe(sceneTwoId);
  });

  it("Should handle a websocket connection", done => {
    const client = new WebSocketClient();
    client.on('connect', conn => {
      conn.on('message', msg => {
        try {
          expect(msg).toHaveProperty('utf8Data');
          const data = JSON.parse(msg.utf8Data);
          expect(data.method).toBe('connection');
        } finally {
          conn.close();
        }
      })
      conn.on('close', () => done());
    });
    client.connect('ws://localhost:3000?bearer=asdf', 'echo-protocol');
  });

  it("Should close the first connection if the same user opens a second", done => {
    const client = new WebSocketClient();
    let connCount = 0;
    let closeCount = 0;
    client.on('connect', conn => {
      conn.on('message', msg => {
        connCount++;
        expect(msg).toHaveProperty('utf8Data');
        const data = JSON.parse(msg.utf8Data);
        expect(data.method).toBe('connection');
        if (connCount === 2) conn.close();
      })
      conn.on('close', () => {
        closeCount++
        if (closeCount === 2) {
          console.log('SECOND SOCKET CLOSED AS EXPECTED');
          done();
        } else console.log('FIRST SOCKET CLOSED AS EXPECTED');
      });
    });
    client.connect('ws://localhost:3000?bearer=asdf', 'echo-protocol');
    setTimeout(() => {
      client.connect('ws://localhost:3000?bearer=qwer', 'echo-protocol')
    }, 250);
  });

  it("Should handle a websocket connection", (done) => {
    let closeCount = 0;
    const client = new WebSocketClient();
    client.on('connect', conn => {
      conn.on('message', msg => {
        try {
          expect(msg).toHaveProperty('utf8Data');
          const data = JSON.parse(msg.utf8Data);
          expect(data.method).toBe('connection');
          expect(data.state.background).toMatch(/public.*\/scene\/.*\/background\.png/)
        } finally {
          conn.close();
        }
      })
      conn.on('close', () => {
        closeCount++;
        if (closeCount === 2) done();
      });
    });
    client.connect('ws://localhost:3000?bearer=asdf', 'echo-protocol');
    setTimeout(() => {
      (getFakeUser as jest.Mock).mockReturnValue(userOne);
      client.connect('ws://localhost:3000?bearer=qwer', 'echo-protocol')
    }, 250);
  });
});