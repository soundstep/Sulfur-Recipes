import { Router, type IRouter } from "express";
import healthRouter from "./health";
import recipesRouter from "./recipes";
import scanRouter from "./scan";

const router: IRouter = Router();

router.use(healthRouter);
router.use(recipesRouter);
router.use(scanRouter);

export default router;
