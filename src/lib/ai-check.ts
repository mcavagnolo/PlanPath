export interface Conflict {
  id: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  codeReference: string;
}

export async function checkBuildingPlan(
  file: File,
  location: string,
  buildingType: string
): Promise<Conflict[]> {
  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Mock logic: return some conflicts based on inputs to simulate AI analysis
  const conflicts: Conflict[] = [];

  // Always add a sample conflict for demonstration
  conflicts.push({
      id: 'demo-1',
      description: 'ADA ramp slope exceeds 1:12 ratio in the main entrance area.',
      severity: 'high',
      codeReference: 'ADA Standards 405.2'
  });

  if (location.toLowerCase().includes('new york')) {
    conflicts.push({
      id: 'nyc-1',
      description: 'Staircase width is less than required 44 inches for this occupancy load.',
      severity: 'high',
      codeReference: 'NYC Building Code 1005.3.2'
    });
  }

  if (buildingType.toLowerCase() === 'residential') {
     conflicts.push({
      id: 'res-1',
      description: 'Bedroom window egress net clear opening is less than 5.7 sq ft.',
      severity: 'medium',
      codeReference: 'IRC R310.2.1'
    });
  }

  return conflicts;
}
