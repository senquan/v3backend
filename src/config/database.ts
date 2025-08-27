import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

import { Branch } from '../models/entities/Branch.entity';
import { ConstructionWorker } from '../models/entities/ConstructionWorker.entity';
import { Project } from '../models/entities/Project.entity';
import { ProjectDepartmentMember } from '../models/entities/ProjectDepartmentMember.entity';
import { User } from '../models/entities/User.entity';


import { Category } from '../models/entities/Category.entity';
import { Certificate } from '../models/entities/Certificate.entity';
import { CertificateTemplate } from '../models/entities/CertificateTemplate.entity';
import { Courseware } from '../models/entities/Courseware.entity';
import { CoursewareMaterial } from '../models/entities/CoursewareMaterial.entity';
import { Exam } from '../models/entities/Exam.entity';
import { ExamAnswer } from '../models/entities/ExamAnswer.entity';
import { ExamQuestion } from '../models/entities/ExamQuestion.entity';
import { ExamRecord } from '../models/entities/ExamRecord.entity';
import { Material } from '../models/entities/Material.entity';
import { Matrix } from '../models/entities/Matrix.entity';
import { Question } from '../models/entities/Question.entity';
import { QuestionOption } from '../models/entities/QuestionOption.entity';
import { StudyPlan } from '../models/entities/StudyPlan.entity';
import { StudyCourseware } from '../models/entities/StudyCourseware.entity';
import { Survey } from '../models/entities/Survey.entity';
import { SurveyQuestion } from '../models/entities/SurveyQuestion.entity';
import { SurveyQuestionOption } from '../models/entities/SurveyQuestionOption.entity';
import { SurveySubmission } from '../models/entities/SurveySubmission.entity';
import { SurveyAnswer } from '../models/entities/SurveyAnswer.entity';
import { Tag } from '../models/entities/Tag.entity';
import { Task } from '../models/entities/Task.entity';
import { TaskAssignment } from '../models/entities/TaskAssignment.entity';
import { TaskItem } from '../models/entities/TaskItem.entity';
import { TaskProgress } from '../models/entities/TaskProgress.entity';
import { Trainer } from '../models/entities/Trainer.entity';
import { TrainerTag } from '../models/entities/TrainerTag.entity';
import { TrainingPlan } from '../models/entities/TrainingPlan.entity';
import { TrainingPlanScope } from '../models/entities/TrainingPlanScope.entity';
import { TrainingRecord } from '../models/entities/TrainingRecord.entity';
import { TrainingRecordContent } from '../models/entities/TrainingRecordContent.entity';
import { TrainingRecordCourseware } from '../models/entities/TrainingRecordCourseware.entity';
import { TrainingRecordProgress } from '../models/entities/TrainingRecordProgress.entity';
import { TrainingRecordProgressDetail } from '../models/entities/TrainingRecordProgressDetail.entity';
import { TrainingRecordParticipant } from '../models/entities/TrainingRecordParticipant.entity';
import { TrainingUser } from '../models/entities/TrainingUser.entity';


// 加载环境变量
dotenv.config();

// 创建数据源
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'training',
  schema: process.env.DB_SCHEMA || 'public',
  synchronize: process.env.NODE_ENV !== 'production', // 开发环境自动同步数据库结构
  logging: process.env.NODE_ENV !== 'production',
  entities: [Branch, ConstructionWorker, Project, ProjectDepartmentMember, User
    , Category, Certificate, CertificateTemplate, Courseware, CoursewareMaterial, Exam, ExamAnswer, ExamQuestion, ExamRecord, Material, Matrix, Question
    , QuestionOption, StudyPlan, StudyCourseware, Survey, SurveyQuestion, SurveyQuestionOption, SurveySubmission, SurveyAnswer, Tag, Task, TaskAssignment, TaskItem, TaskProgress
    , Trainer, TrainerTag, TrainingPlan, TrainingPlanScope, TrainingRecord, TrainingRecordContent, TrainingRecordCourseware, TrainingRecordProgress
    , TrainingRecordProgressDetail,TrainingRecordParticipant, TrainingUser],
  migrations: [__dirname + '/../migrations/**/*.ts'],
  subscribers: [__dirname + '/../subscribers/**/*.ts'],
});

// export const ReadOnlyDataSource = new DataSource({
//   type: 'postgres',
//   host: process.env.DB_HOST || 'localhost',
//   port: parseInt(process.env.DB_PORT || '5432'),
//   username: process.env.DB_USER || 'postgres',
//   password: process.env.DB_PASS || 'password',
//   database: process.env.DB_NAME || 'training',
//   synchronize: false, // 永不同步
//   logging: false,
//   entities: [Branch, ConstructionWorker, Project, ProjectDepartmentMember, User],
// });