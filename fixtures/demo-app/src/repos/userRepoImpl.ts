import type { DB } from "../db/sqlite.js";
import type { UserRepo } from "../services/authService.js";
import { createUser, findUserByEmail, findUserById } from "./userRepo.js";

export function makeUserRepo(db: DB): UserRepo {
  return {
    findUserByEmail: (email) => findUserByEmail(db, email),
    findUserById: (id) => findUserById(db, id),
    createUser: (email, passwordHash) => createUser(db, email, passwordHash),
  };
}
