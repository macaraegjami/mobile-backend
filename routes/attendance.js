import { Router } from 'express';
const router = Router();
import Attendance from '../models/Attendance.js';

// ✅ Get all attendance
router.get('/', async (req, res) => {
  try {
    const data = await Attendance.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Check if user is currently checked in
router.get('/status/:studentID', async (req, res) => {
  try {
    const { studentID } = req.params;
    
    // Find the most recent check-in without checkout
    const currentCheckIn = await Attendance.findOne({
      studentID,
      checkOutTime: { $exists: false }
    }).sort({ checkInTime: -1 });

    res.json({
      success: true,
      isCheckedIn: !!currentCheckIn,
      currentSession: currentCheckIn
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error checking attendance status' });
  }
});

// ✅ Scan (ALWAYS create new check-in with CURRENT timestamp)
router.post('/scan', async (req, res) => {
  try {
    const { studentID, firstName, lastName, course, yearLevel, purpose, email } = req.body;
    
    // CRITICAL: Use current server time for accurate check-in timestamp
    const currentTime = new Date();
    const todayDateString = currentTime.toLocaleDateString('en-US', {
      timeZone: 'Asia/Manila' // Adjust to your timezone
    });

    console.log(`Check-in scan for ${studentID} at ${currentTime.toISOString()}`);

    // ALWAYS create a new check-in record with current server time
    const newAttendance = new Attendance({
      studentID, 
      firstName, 
      lastName, 
      course, 
      yearLevel, 
      email, 
      purpose,
      checkInTime: currentTime, // This is the ACTUAL check-in time
      scanDate: todayDateString,
      status: 'checked-in'
    });

    await newAttendance.save();
    
    console.log(`Successfully saved check-in for ${studentID}:`, {
      checkInTime: newAttendance.checkInTime,
      scanDate: newAttendance.scanDate
    });
    
    res.json({ 
      success: true, 
      action: 'checkin', 
      message: 'Successfully checked in', 
      attendance: newAttendance,
      serverTime: currentTime.toISOString() // Send server time for verification
    });
  } catch (error) {
    console.error('Error during scan:', error);
    res.status(500).json({ success: false, message: 'Error processing attendance' });
  }
});

// ✅ Manual Checkout endpoint with CURRENT timestamp
router.post('/checkout/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    
    // Use current server time for accurate checkout timestamp
    const currentTime = new Date();
    
    const attendance = await Attendance.findById(recordId);
    
    if (!attendance) {
      return res.status(404).json({ success: false, error: 'Attendance record not found.' });
    }
    
    if (attendance.checkOutTime) {
      return res.status(400).json({ success: false, error: 'Already checked out.' });
    }
    
    // Calculate duration using ACTUAL timestamps
    const checkInTime = new Date(attendance.checkInTime);
    const durationMinutes = Math.round((currentTime - checkInTime) / (1000 * 60));
    
    attendance.checkOutTime = currentTime; // ACTUAL checkout time
    attendance.status = 'checked-out';
    attendance.duration = durationMinutes;
    
    await attendance.save();
    
    console.log(`Manual checkout for record ${recordId}:`, {
      checkInTime: attendance.checkInTime,
      checkOutTime: attendance.checkOutTime,
      duration: durationMinutes
    });
    
    res.json({ 
      success: true, 
      attendance,
      serverTime: currentTime.toISOString()
    });
  } catch (error) {
    console.error('Error during checkout:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Auto-checkout all records at end of day (run as cron job)
router.post('/auto-checkout', async (req, res) => {
  try {
    // Use current server time for auto-checkout
    const currentTime = new Date();
    const todayDateString = currentTime.toLocaleDateString('en-US', {
      timeZone: 'Asia/Manila'
    });
    
    console.log(`Auto-checkout process started at ${currentTime.toISOString()}`);
    
    // Find all records from today that haven't been checked out
    const recordsToUpdate = await Attendance.find({
      scanDate: todayDateString,
      checkOutTime: { $exists: false }
    });
    
    let updatedCount = 0;
    
    for (const record of recordsToUpdate) {
      const checkInTime = new Date(record.checkInTime);
      const durationMinutes = Math.round((currentTime - checkInTime) / (1000 * 60));
      
      record.checkOutTime = currentTime; // ACTUAL auto-checkout time
      record.status = 'auto-checkout';
      record.duration = durationMinutes;
      record.autoCheckoutNote = `Auto-checked out at ${currentTime.toLocaleString()}`;
      
      await record.save();
      updatedCount++;
      
      console.log(`Auto-checkout record ${record._id}: ${durationMinutes} minutes`);
    }
    
    res.json({
      success: true,
      message: `Auto-checked out ${updatedCount} records`,
      updatedCount,
      autoCheckoutTime: currentTime.toISOString()
    });
  } catch (error) {
    console.error('Error during auto-checkout:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Get today's attendance
router.get('/today', async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-US', {
      timeZone: 'Asia/Manila'
    });
    
    const attendanceRecords = await Attendance.find({ 
      scanDate: today 
    }).sort({ checkInTime: -1 }); // Sort by ACTUAL check-in time

    res.json({
      success: true,
      records: attendanceRecords,
      totalCheckedIn: attendanceRecords.filter(r => r.status === 'checked-in').length,
      totalCheckedOut: attendanceRecords.filter(r => r.status === 'checked-out').length,
      totalAutoCheckout: attendanceRecords.filter(r => r.status === 'auto-checkout').length,
      queryDate: today
    });
  } catch (error) {
    console.error('Error fetching today\'s attendance:', error);
    res.status(500).json({ success: false, message: 'Error fetching attendance records' });
  }
});

// ✅ Get all records for a student (FIXED - show actual timestamps)
router.get('/student/:studentID', async (req, res) => {
  try {
    const { studentID } = req.params;
    
    // Get records sorted by ACTUAL check-in time (most recent first)
    const records = await Attendance.find({ studentID }).sort({ checkInTime: -1 });

    console.log(`Retrieved ${records.length} records for student ${studentID}`);

    // Transform each record to display ACTUAL times (not current time)
    const result = records.map(rec => {
      const checkInTime = new Date(rec.checkInTime);
      const checkOutTime = rec.checkOutTime ? new Date(rec.checkOutTime) : null;
      
      return {
        id: rec._id,
        date: rec.scanDate, // Use stored scan date
        checkIn: checkInTime.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true 
        }),
        checkOut: checkOutTime ? checkOutTime.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true 
        }) : null,
        purpose: rec.purpose || '',
        rawDate: rec.checkInTime, // Use ACTUAL check-in time for sorting
        status: rec.status,
        duration: rec.duration,
        // Include original timestamps for debugging
        originalCheckInTime: rec.checkInTime,
        originalCheckOutTime: rec.checkOutTime,
        scanDate: rec.scanDate
      };
    });

    res.json({ 
      success: true, 
      records: result,
      studentID: studentID
    });
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    res.status(500).json({ success: false, message: 'Error fetching attendance records' });
  }
});

// ✅ New endpoint: Get current check-in status for a student
router.get('/current-status/:studentID', async (req, res) => {
  try {
    const { studentID } = req.params;
    
    // Find active session (checked in but not checked out)
    const activeSession = await Attendance.findOne({
      studentID,
      status: 'checked-in',
      checkOutTime: { $exists: false }
    }).sort({ checkInTime: -1 });

    if (activeSession) {
      const checkInTime = new Date(activeSession.checkInTime);
      const currentTime = new Date();
      const sessionDuration = Math.round((currentTime - checkInTime) / (1000 * 60));
      
      res.json({
        success: true,
        isActive: true,
        session: {
          id: activeSession._id,
          checkInTime: activeSession.checkInTime,
          checkInDisplay: checkInTime.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
          }),
          duration: sessionDuration,
          purpose: activeSession.purpose
        }
      });
    } else {
      res.json({
        success: true,
        isActive: false,
        session: null
      });
    }
  } catch (error) {
    console.error('Error checking current status:', error);
    res.status(500).json({ success: false, message: 'Error checking current status' });
  }
});

export default router;