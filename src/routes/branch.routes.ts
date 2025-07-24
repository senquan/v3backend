import { Router } from "express";
import { BranchController } from "../controllers/branch.controller";

const router = Router();
const branchController = new BranchController();

// 部门管理路由
router.get("/list", branchController.getList.bind(branchController));

export default router;