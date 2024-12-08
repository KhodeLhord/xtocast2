import pool from '../db/db.js';
import { v4 as uuidv4 } from 'uuid';  // Import UUID to generate unique ticket ID
import QRCode from 'qrcode';  // Import QRCode for generating QR codes
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the current directory (__dirname equivalent)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust the path to your public/qrcodes directory
const qrCodeDirectory = path.join(__dirname, '..', '..', 'public', 'qrcodes');  // Adjusted path

export const createTicket = async (req, res) => {
  try {
    // Ensure the qrcodes directory exists
    if (!fs.existsSync(qrCodeDirectory)) {
      fs.mkdirSync(qrCodeDirectory, { recursive: true });
    }

    // Generate ticket_id using UUID
    const ticket_id = uuidv4();

    // Create the base URL for the ticket
    const baseURL = 'http://localhost:7000'; // Replace with your domain
    const ticketURL = `${baseURL}/t/${ticket_id}/index.html?id=${ticket_id}`; // Full URL for the ticket

    // Generate QR code and save it as an image file
    const qrCodePath = path.join(qrCodeDirectory, `${ticket_id}.png`);
    await QRCode.toFile(qrCodePath, ticketURL);

    // Construct URL to the QR code image
    const qrCodeImageUrl = `${baseURL}/public/qrcodes/${ticket_id}.png`;

    // Destructure required fields from the request body
    const {
      t_id ,
      event_id,
      buyer_name,
      buyer_email,
      buyer_phone,
      event_name,
      ticket_type,
      ticket_price,
      quantity,
      total_price,
      transaction_status,
      payment_method,
      transaction_date,
      discountCode
    } = req.body;  

    // console.log(req.body);

    let validDiscountCode = null;

    if (discountCode) {
        const [discountResult] = await pool.execute('SELECT * FROM discount_codes WHERE code = ?', [discountCode]);
        if (discountResult.length > 0) {
            validDiscountCode = discountCode; // Use the valid discount code
        } else {
            console.log(`Discount code ${discountCode} does not exist`);
        }
    }

    // If discount code is not valid or does not exist, set to NULL
    const query = `
    INSERT INTO ticket_transactions (
      event_id, t_id, ticket_id, buyer_name, buyer_email, buyer_phone, quantity,
      event_name,ticket_type,ticket_price, discount_code, total_price, qr_code, transaction_status,
      payment_method, transaction_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    event_id,
    t_id,
    ticket_id,
    buyer_name,
    buyer_email,
    buyer_phone,
    quantity,
    event_name,
    ticket_type,
    ticket_price,
    validDiscountCode || null, // If no valid discount, set to null
    total_price,
    qrCodeImageUrl,
    transaction_status,
    payment_method,
    transaction_date
  ];
  
  console.log("Params being passed:", params);
  
  const [result] = await pool.execute(query, params);
    // 
    // Send back the success response
    res.status(201).json({
      message: 'Ticket created successfully',
      data: {
        id: result.insertId,  // Use the insertId from the result
        ticket_id,
        ticket_url: ticketURL,
        qr_code: qrCodeImageUrl,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Failed to create ticket',
      error: error.message,
    });
  }
};

export const getTicketByUuid = async (req, res) => {
  try {
    // Get the ticket_id from the URL parameter (UUID)
    const { ticket_id } = req.params;  // Assuming the URL is like /ticket/:ticket_id

    // Query the database to get the ticket by UUID
    const [result] = await pool.execute('SELECT * FROM ticket_transactions WHERE ticket_id = ?', [ticket_id]);

    // If no ticket is found, return a 404 error
    if (result.length === 0) {
      return res.status(404).json({
        message: 'Ticket not found',
      });
    }

    // If the ticket is found, return the ticket data
    res.status(200).json({
      message: 'Ticket retrieved successfully',
      data: result[0],  // Assuming the first result is the ticket
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Failed to retrieve ticket',
      error: error.message,
    });
  }
};

export const fetchTicketingEvent = async (req, res) => {
  try {
    // Get the event ID from route parameters (params)
    const { ticket_id } = req.params;

    // Base SQL query to select event and related ticket transactions by ticket_transactions.event_id
    let query = `
      SELECT 
        ticketing_events.id AS id, 
        ticketing_events.uuid AS event_uuid, 
        ticketing_events.name AS event_name, 
        ticketing_events.description AS event_description, 
        ticketing_events.start_date AS start_date, 
        ticketing_events.end_date AS end_date, 
        ticketing_events.start_time AS start_time, 
        ticketing_events.end_time AS end_time, 
        ticketing_events.location AS event_location, 
        ticketing_events.about_event AS about_event,
        ticketing_events.image_url AS event_image_url, 
        ticketing_events.is_premium AS event_is_premium, 
        ticket_transactions.event_id AS event_id,
        ticket_transactions.buyer_name AS buyer_name,
        ticket_transactions.buyer_email AS buyer_email,
        ticket_transactions.buyer_phone AS buyer_phone,
        ticket_transactions.quantity AS quantity,
        ticket_transactions.discount_code AS discount_code,
        ticket_transactions.total_price AS total_price,
        ticket_transactions.transaction_status AS transaction_status,
        ticket_transactions.payment_method AS payment_method,
        ticket_transactions.qr_code AS qr_code,
        ticket_transactions.transaction_date AS transaction_date,
        ticket_transactions.ticket_id AS ticket_id,
        ticket_transactions.t_id AS t_id,
        tickets.ticket_type AS ticket_type
      FROM 
        ticket_transactions
      LEFT JOIN 
        ticketing_events ON ticket_transactions.event_id = ticketing_events.id
      LEFT JOIN
        tickets ON ticket_transactions.t_id = tickets.id
    `;

    // If event_id is provided in the route params, modify the query to filter by that specific event_id
    if (ticket_id) {
      query += ` WHERE ticket_transactions.ticket_id = ? LIMIT 1`;  // Filter by event_id and limit to 1 result
    }

    // Execute the query
    const [results] = await pool.query(query, ticket_id ? [ticket_id] : []);
    
    // Send the result (single event with its ticket transactions) to the client
    if (results.length > 0) {
      res.json(results[0]);  // Send the first result (single event)
    } else {
      res.status(404).json({ error: "Event not found" });
    }
    
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "An unexpected error occurred" });
  }
};
