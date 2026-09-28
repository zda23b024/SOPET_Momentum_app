import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
async function main() { const app = await NestFactory.createApplicationContext(AppModule); try { const result = await app.get(UsersService).processDueAccountDeletions(); console.log(`Processed due account deletions: ${result.processed}`); } finally { await app.close(); } }
main().catch(error => { console.error(`Deletion processor failed: ${error.message}`); process.exitCode = 1; });
