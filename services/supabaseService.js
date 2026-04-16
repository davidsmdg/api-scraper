const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const saveMemoryResource = async (userId, projectId, category, title, content, resourceType = 'text') => {
    try {
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

const getMemoryByCategory = async (userId, category, projectId = null) => {
    try {
        let query = supabase
            .from('memory_resources')
            .select('content')
            .eq('user_id', userId)
            .eq('memory_category', category);
        
        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error obteniendo memoria de Supabase:', error.message);
        throw error;
    }
};

const saveIndustryNews = async (newsItems) => {
    try {
        const { data, error } = await supabase
            .from('industry_news')
            .insert(newsItems);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error guardando noticias de industria:', error.message);
        throw error;
    }
};

module.exports = { saveMemoryResource, getMemoryByCategory, saveIndustryNews };
