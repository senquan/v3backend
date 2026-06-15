import { Module } from '@nestjs/common';
import { FollowUpReminderJob } from './follow-up.job';

@Module({
  providers: [FollowUpReminderJob],
})
export class FollowUpModule {}
