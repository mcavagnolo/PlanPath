import { ref, listAll } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export const fetchJurisdictionOptions = async () => {
  const options = {
    states: [] as string[],
    counties: [] as string[],
    cities: [] as string[]
  };

  try {
    // Fetch States
    const statesRef = ref(storage, 'knowledge-base/State');
    const statesRes = await listAll(statesRef);
    options.states = statesRes.prefixes.map(folder => folder.name);

    // Fetch Counties
    const countiesRef = ref(storage, 'knowledge-base/County');
    const countiesRes = await listAll(countiesRef);
    options.counties = countiesRes.prefixes.map(folder => folder.name);

    // Fetch Cities
    const citiesRef = ref(storage, 'knowledge-base/City');
    const citiesRes = await listAll(citiesRef);
    options.cities = citiesRes.prefixes.map(folder => folder.name);
  } catch (error) {
    console.error("Error fetching jurisdiction options:", error);
  }

  return options;
};
