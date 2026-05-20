import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import foldersRouter from "./folders";
import notebooksRouter from "./notebooks";
import notesRouter from "./notes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(foldersRouter);
router.use(notebooksRouter);
router.use(notesRouter);

export default router;
