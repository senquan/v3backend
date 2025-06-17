import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Branch } from '../models/entities/Branch.entity';
import { Category } from '../models/entities/Category.entity';
import { Courseware } from '../models/entities/Courseware.entity';
import { CoursewareMaterial } from '../models/entities/CoursewareMaterial.entity';
import { Exam } from '../models/entities/Exam.entity';
import { ExamAnswer } from '../models/entities/ExamAnswer.entity';
import { ExamQuestion } from '../models/entities/ExamQuestion.entity';
import { ExamRecord } from '../models/entities/ExamRecord.entity';
import { Material } from '../models/entities/Material.entity';
import { Matrix } from '../models/entities/Matrix.entity';
import { Project } from '../models/entities/Project.entity';
import { ProjectDepartmentMember } from '../models/entities/ProjectDepartmentMember.entity';
import { Question } from '../models/entities/Question.entity';
import { QuestionOption } from '../models/entities/QuestionOption.entity';
import { TrainingPlan } from '../models/entities/TrainingPlan.entity';
import { TrainingPlanScope } from '../models/entities/TrainingPlanScope.entity';
import { TrainingRecord } from '../models/entities/TrainingRecord.entity';
import { TrainingRecordContent } from '../models/entities/TrainingRecordContent.entity';
import { TrainingRecordCourseware } from '../models/entities/TrainingRecordCourseware.entity';
import { TrainingRecordParticipant } from '../models/entities/TrainingRecordParticipant.entity';
import { User } from '../models/entities/User.entity';
import { ConstructionWorker } from '../models/entities/ConstructionWorker.entity';

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
  synchronize: process.env.NODE_ENV !== 'production', // 开发环境自动同步数据库结构
  logging: process.env.NODE_ENV !== 'production',
  entities: [Branch, Category, Courseware, CoursewareMaterial, Exam, ExamAnswer, ExamQuestion, ExamRecord, Material, Matrix, Project, ProjectDepartmentMember, Question
    , QuestionOption, TrainingPlan, TrainingPlanScope, TrainingRecord, TrainingRecordContent, TrainingRecordCourseware, TrainingRecordParticipant, User, ConstructionWorker],
  migrations: [__dirname + '/../migrations/**/*.ts'],
  subscribers: [__dirname + '/../subscribers/**/*.ts'],
});