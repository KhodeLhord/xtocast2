import express from 'express';
import { createTicket , getTicketByUuid,fetchTicketingEvent } from '../controllers/transactionTicket.js';

const router = express.Router();

// Route to create a new fundraiser
router.post('/create', createTicket);
router.get('/:ticket_id', getTicketByUuid);
router.get('/event/:ticket_id', fetchTicketingEvent);

export default router;


