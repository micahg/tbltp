process.env['DISABLE_AUTH'] = "true";
import { app, serverPromise, shutDown, startUp} from '../src/server' ;
import * as request from 'supertest';
import {afterAll, beforeEach, beforeAll, describe, it, expect, jest} from '@jest/globals';
import { getFakeUser, getOAuthPublicKey } from '../src/utils/auth';

import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Collection} from 'mongodb';
import { userZero } from './assets/auth';

let mongodb: MongoMemoryServer;
let mongocl: MongoClient;
let scenesCollection: Collection;
let usersCollection: Collection;

let u0DefScene;

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

  // setup the base scene
  it("should create a base scene first", async () => {
    const resp0 = await request(app).get('/scene');
    u0DefScene = resp0.body[0];
    const uid1 = u0DefScene.user;
    expect(resp0.statusCode).toBe(200);
    expect(u0DefScene.description).toEqual('default');
    const sceneCount0 = await scenesCollection.countDocuments();
    expect(sceneCount0).toBe(1)
    const userCount0 = await usersCollection.countDocuments();
    expect(userCount0).toBe(1);
    const url = `/scene/${u0DefScene._id}/content`;
    await request(app).put(url).field('layer', 'player').attach('image', 'test/assets/1x1.png');
    const resp = await request(app)
      .put(`/scene/${u0DefScene._id}/viewport`)
      .send({
        backgroundSize: { x: 0, y: 0, width: 1, height: 1},
        viewport: { x: 0, y: 0, width: 1, height: 1},
      });
    expect(resp.statusCode).toBe(200);
    expect(resp.body.viewport.width).toBe(1);
    expect(resp.body.playerContentRev).toBe(1);
    expect(resp.body.backgroundSize.width).toBe(1);
  });

  it("Should get an empty state until we update", async () => {
    const resp = await request(app).get('/state');
    expect(resp.statusCode).toBe(200);
    const table = resp.body;
    expect(table).toBeNull();
  });

  it("Should fail without a scene id", async () => {
    const resp = await request(app).put('/state').send({});
    expect(resp.statusCode).toBe(400);
  });

  it("Should update with a background", async () => {
    const resp = await request(app).put('/state').send({scene: u0DefScene._id});
    expect(resp.statusCode).toBe(200);
  });

  it("Should should have a playerContentRev of 2 on a second update", async () => {
    const url = `/scene/${u0DefScene._id}/content`;
    const resp = await request(app).put(url).field('layer', 'player').attach('image', 'test/assets/1x1.png');
    expect(resp.statusCode).toBe(200);
    expect(resp.body.playerContentRev).toBe(2);
  });

  it("Should should have a overlayContentRev of 1 on a first update", async () => {
    const url = `/scene/${u0DefScene._id}/content`;
    const resp = await request(app).put(url).field('layer', 'overlay').attach('image', 'test/assets/1x1.png');
    expect(resp.statusCode).toBe(200);
    expect(resp.body.overlayContentRev).toBe(1);
  });

  it("Should should have a overlayContentRev of 2 on a second update", async () => {
    const url = `/scene/${u0DefScene._id}/content`;
    const resp = await request(app).put(url).field('layer', 'overlay').attach('image', 'test/assets/1x1.png');
    expect(resp.statusCode).toBe(200);
    expect(resp.body.overlayContentRev).toBe(2);
  });
});  