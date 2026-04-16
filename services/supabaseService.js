const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const saveMemoryResource = async (userId, projectId, category, title, content) => {
    try {
        // Corrección de columna: la tabla usa 'memory_category', no 'category'
        const { data, error } = await supabase.from('memory_resources').insert([
            { 
                user_id: userId, 
                project_id: projectId, 
                memory_category: category, 
                title: title, 
                content: content 
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