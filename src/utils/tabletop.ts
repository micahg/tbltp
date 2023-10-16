import { ITableTop, TableTop } from "../models/tabletop";
import { IUser } from "../models/user";

function createDefaultTableTop(user: IUser) {
  return TableTop.create({ user: user._id });
}
export function getTableTopByUser(user: IUser): Promise<ITableTop> {
  return TableTop.findOne({user: user._id})
}

export function setTableTopByScene(tableId: string, sceneId: string) {
  return TableTop.findOneAndUpdate({_id: tableId}, {scene: sceneId});
}

export function getOrCreateTableTop(user: IUser): Promise<ITableTop> {
  return new Promise((resolve) => {
    getTableTopByUser(user)
      .then(table => {
        if (table) return resolve(table);
        return createDefaultTableTop(user).then(table => resolve(table));
      });
  });
}