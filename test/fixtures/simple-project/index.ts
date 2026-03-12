import { formatDate, capitalize } from './utils';
import { UserService } from './service';

const service = new UserService();

export function main(): void {
  const user = service.getUser('123');
  const name = capitalize(user.name);
  const joined = formatDate(user.joinedAt);
  console.log(`${name} joined on ${joined}`);
}

export { UserService } from './service';
