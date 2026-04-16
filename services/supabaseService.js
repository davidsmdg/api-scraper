const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const saveMemoryResource = async (userId, projectId, category, title, content, resourceType = 'text') => {
    try {
        // Corrección: agregando 'resource_type' que es obligatorio (NOT NULL)
        const { data, error } = await supabase.from('memory_resources').insert([
            { 
                user_id: userId, 
                project_id: projectId, 
                memory_category: category, 
                title: title, 
                content: typeof content === 'object' ? JSON.stringify(content) : content,
                resource_type: resourceType
            }
        ]);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error guardando en Supabase:', error.message);
        throw error;
    }
};

module.exports = { saveMemoryResource };