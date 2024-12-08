import  pool  from '../db/db.js'; // Assuming you have a DB config setup

export const validatePromoCode = async (req, res) => {
    const { promoCode } = req.body;
    try {
        const query = `
            SELECT * FROM discount_codes
            WHERE code = ? AND expiration_date >= CURDATE() 
        `;
        const [rows] = await pool.execute(query, [promoCode]);

        if (rows.length === 0) {
            console.log( 400, "Promo code not found");
            return res.status(400).json({ message: 'Invalid or expired promo code' });
        }

        res.status(200).json({
            message: 'Promo code is valid',
            discount: rows[0].discount_type,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error validating promo code', error: error.message });
    }
};
