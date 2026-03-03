// 🚀 OPTIMIZED API USAGE EXAMPLE
// Replace multiple API calls with one batch call

// ❌ OLD WAY (4-5 seconds):
// const bu = await businessUnitApi.get(buId);
// const facts = await intelligenceApi.getFacts(buId);
// const reconciliation = await intelligenceApi.getReconciliation(buId);
// const existingIM = await intelligenceApi.getExistingIM(buId);

// ✅ NEW WAY (1-2 seconds):
const loadBusinessDataOptimized = async (buId) => {
    try {
        console.log('📦 Loading all business data in one call...');
        const fullData = await businessUnitApi.getFullData(buId);
        
        // Extract data from the batch response
        const { business_unit, facts, reconciliation, existing_im } = fullData;
        
        console.log('✅ Loaded all data:', {
            bu: business_unit?.name,
            factsCount: facts?.length || 0,
            conflictsCount: reconciliation?.conflicts?.length || 0,
            hasExistingIM: !!existing_im
        });
        
        return { business_unit, facts, reconciliation, existing_im };
    } catch (error) {
        console.error('❌ Failed to load business data:', error);
        throw error;
    }
};

// 🎯 USAGE IN YOUR COMPONENTS:
function YourComponent({ buId }) {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    
    React.useEffect(() => {
        if (buId) {
            loadBusinessDataOptimized(buId)
                .then(setData)
                .finally(() => setLoading(false));
        }
    }, [buId]);
    
    if (loading) return React.createElement('div', null, 'Loading...');
    if (!data) return React.createElement('div', null, 'No data');
    
    return React.createElement('div', null, [
        React.createElement('h1', null, data.business_unit.name),
        React.createElement('p', null, `Facts: ${data.facts.length}`),
        React.createElement('p', null, `Conflicts: ${data.reconciliation.conflicts.length}`),
        data.existingIM && React.createElement('p', null, 'IM Generated')
    ]);
}
