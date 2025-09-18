// utils/materialStatusUpdater.js
import BorrowRequest from '../models/BorrowRequest.js';
import LearningMaterial from '../models/LearningMaterials.js';

async function updateMaterialStatuses() {
  try {
    // Find all borrow requests that should affect material status
    const activeRequests = await BorrowRequest.find({
      status: { $in: ['pending', 'borrowed', 'overdue'] }
    });

    // First reset all materials to available
    await LearningMaterial.updateMany({}, { status: 'available' });

    // Then update based on active requests
    for (const request of activeRequests) {
      await LearningMaterial.findByIdAndUpdate(
        request.materialId,
        { status: request.status === 'pending' ? 'pending' : 'borrowed' }
      );
    }
  } catch (error) {
    console.error('Error syncing material statuses:', error);
  }
}

export { updateMaterialStatuses };