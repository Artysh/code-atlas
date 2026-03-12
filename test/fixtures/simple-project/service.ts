import { formatDate } from './utils';

interface User {
  id: string;
  name: string;
  joinedAt: Date;
}

export class UserService {
  private users: Map<string, User> = new Map();

  getUser(id: string): User {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    return user;
  }

  createUser(name: string): User {
    const id = Math.random().toString(36).slice(2);
    const user: User = { id, name, joinedAt: new Date() };
    this.users.set(id, user);
    return user;
  }

  formatUserJoinDate(user: User): string {
    return formatDate(user.joinedAt);
  }
}

export enum UserRole {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest',
}
