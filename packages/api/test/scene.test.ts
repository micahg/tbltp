process.env['DISABLE_AUTH'] = "true";
import { app, serverPromise, shutDown, startUp} from '../src/server' ;
import * as request from 'supertest';
import {afterAll, beforeEach, beforeAll, describe, it, expect, jest} from '@jest/globals';
import { Server } from 'node:http';
import { getFakeUser, getOAuthPublicKey } from '../src/utils/auth';

import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Collection} from 'mongodb';
import { userZero, userOne } from './assets/auth';
import { fail } from 'node:assert';

let server: Server;
let mongodb: MongoMemoryServer;
let mongocl: MongoClient;
let scenesCollection: Collection;
let usersCollection: Collection;

let u0DefScene;
let u1DefScene;

jest.mock('../src/utils/auth');

beforeAll(done => {
  // mongo 7 needs wild tiger
  MongoMemoryServer.create({instance: {storageEngine: 'wiredTiger'}}).then(mongo => {
    mongodb = mongo;
    process.env['MONGO_URL'] = `${mongo.getUri()}ntt`;
    mongocl = new MongoClient(process.env['MONGO_URL']);
    const db = mongocl.db('ntt');
    usersCollection = db.collection('users');
    scenesCollection = db.collection('scenes');

    (getOAuthPublicKey as jest.Mock).mockReturnValue(Promise.resolve('pubkey'));

    startUp();
    serverPromise.then(srvr => { server = srvr; done(); })
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

  it('Should create default scenes', async () => {
    const resp0 = await request(app).get('/scene');
    u0DefScene = resp0.body[0];
    const uid1 = u0DefScene.user;
    expect(resp0.statusCode).toBe(200);
    expect(u0DefScene.description).toEqual('default');
    const sceneCount0 = await scenesCollection.countDocuments();
    expect(sceneCount0).toBe(1)
    const userCount0 = await usersCollection.countDocuments();
    expect(userCount0).toBe(1);

    (getFakeUser as jest.Mock).mockReturnValue(userOne);

    const resp = await request(app).get('/scene');
    u1DefScene = resp.body[0];
    const uid2 = u1DefScene.user;
    expect(resp.statusCode).toBe(200);
    expect(u1DefScene.description).toEqual('default');
    const sceneCount = await scenesCollection.countDocuments();
    expect(sceneCount).toBe(2)
    const userCount = await usersCollection.countDocuments();
    expect(userCount).toBe(2);
    expect(uid1).not.toEqual(uid2);
  });

  it('Should 401 a totally bogus user', async () => {
    (getFakeUser as jest.Mock).mockReturnValue('THIS_ONE_DOES_NOT_EXST');
    const resp = await request(app).get('/scene/000000000000000000000000');
    expect(resp.statusCode).toBe(401);
  });

  it('Should 400 an invalid scene id', async () => {
    const resp = await request(app).get('/scene/asdf');
    expect(resp.statusCode).toEqual(400);
  });

  it('Should 404 a scene it does not have', async () => {
    const resp = await request(app).get('/scene/000000000000000000000000');
    expect(resp.statusCode).toEqual(404);
  });

  it('Should find a scene it does have access to', async () => {
    const url = `/scene/${u0DefScene._id}`;
    const resp = await request(app).get(url);
    expect(resp.statusCode).toBe(200);
    expect(resp.body._id).toEqual(u0DefScene._id);
    expect(resp.body.description).toEqual('default');
  });

  it('Should accept a background', async () => {
    const url = `/scene/${u0DefScene._id}/content`;
    let resp;
    try {
      resp = await request(app).put(url).field('layer', 'player').attach('image', 'test/assets/1x1.png');
    } catch (err) {
      fail(`Exception: ${JSON.stringify(err)}`);
    }
    expect(resp.statusCode).toBe(200);
  });

  it('Should accept a overlay', async () => {
    const url = `/scene/${u0DefScene._id}/content`;
    let resp;
    try {
      resp = await request(app).put(url).field('layer', 'overlay').attach('image', 'test/assets/1x1.png');
    } catch (err) {
      fail(`Exception: ${JSON.stringify(err)}`);
    }
    expect(resp.statusCode).toBe(200);
  });

  it('Should accept a gamemaster', async () => {
    const url = `/scene/${u0DefScene._id}/content`;
    let resp;
    try {
      resp = await request(app).put(url).field('layer', 'detail').attach('image', 'test/assets/1x1.png');
    } catch (err) {
      fail(`Exception: ${JSON.stringify(err)}`);
    }
    expect(resp.statusCode).toBe(200);
  });

  it("Should update the viewport", async () => {
    const resp = await request(app)
      .put(`/scene/${u0DefScene._id}/viewport`)
      .send({viewport: { x: 0, y: 0, width: 0, height: 0}});
      const vp = resp.body.viewport;
      expect(resp.statusCode).toBe(200);
      expect(resp.body.viewport.width).toBe(0);
  });

  it("Should update the background", async () => {
    const resp = await request(app)
      .put(`/scene/${u0DefScene._id}/viewport`)
      .send({backgroundSize: { x: 0, y: 0, width: 0, height: 0}});
    expect(resp.statusCode).toBe(200);
    expect(resp.body.backgroundSize.width).toBe(0);
  });

  it("Should update the viewport and background", async () => {
    const resp = await request(app)
      .put(`/scene/${u0DefScene._id}/viewport`)
      .send({
        backgroundSize: { x: 0, y: 0, width: 1, height: 1},
        viewport: { x: 0, y: 0, width: 1, height: 1},
      });
    expect(resp.statusCode).toBe(200);
    expect(resp.body.viewport.width).toBe(1);
    expect(resp.body.backgroundSize.width).toBe(1);
  });

  it("Should update the angle", async () => {
    const resp = await request(app)
      .put(`/scene/${u0DefScene._id}/viewport`)
      .send({
        angle: 90,
      });
    expect(resp.statusCode).toBe(200);
    expect(resp.body.angle).toBe(90);
  });

  it("Should handle an empty payload", async () => {
    const resp = await request(app)
      .put(`/scene/${u0DefScene._id}/viewport`)
      .send({});
    expect(resp.statusCode).toBe(400);
  });

  it("Should handle bad viewport", async () => {
    const resp = await request(app)
    .put(`/scene/${u0DefScene._id}/viewport`)
    .send({
      viewport: 'notAVP',
    });
    expect(resp.statusCode).toBe(400);
  });

  it("Should handle bad background", async () => {
    const resp = await request(app)
    .put(`/scene/${u0DefScene._id}/viewport`)
    .send({
      backgroundSize: 'notABG',
    });
    expect(resp.statusCode).toBe(400);
  });

  it("Should handle bad angle", async () => {
    const resp = await request(app)
    .put(`/scene/${u0DefScene._id}/viewport`)
    .send({
      angle: 'noAngle',
    });
    expect(resp.statusCode).toBe(400);
  });

});