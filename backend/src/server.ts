import app from './app';
import { logger } from './config/logger';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
