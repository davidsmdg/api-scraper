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

const updateProjectLogo = async (projectId, logoUrl) => {
    try {
        const { data, error } = await supabase
            .from('projects')
            .update({ logo_url: logoUrl })
            .eq('id', projectId);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error actualizando logo del proyecto:', error.message);
    }
};

const saveIndustryNews = async (newsData) => {
    try {
        const { data, error } = await supabase
            .from('industry_news')
            .insert([newsData]);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error guardando noticias de industria:', error.message);
        throw error;
    }
};

const appendSavedNews = async (newsId, contentToAppend) => {
    try {
        const { data: current, error: getError } = await supabase
            .from('industry_news')
            .select('saved_content')
            .eq('id', newsId)
            .single();

        if (getError) throw getError;

        const newContent = current.saved_content 
            ? `${current.saved_content}\n\n---\n\n${contentToAppend}` 
            : contentToAppend;

        const { data, error } = await supabase
            .from('industry_news')
            .update({ saved_content: newContent })
            .eq('id', newsId);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error al concatenar noticia guardada:', error.message);
        throw error;
    }
};

const saveCompetitor = async (competitorData) => {
    try {
        const { data, error } = await supabase
            .from('competitors')
            .insert([competitorData])
            .select('*');
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('Error guardando competidor:', error.message);
        // Retornamos null para que no rompa el flujo completo si uno falla
        return null; 
    }
};

const saveCompetitorsNews = async (newsData) => {
    try {
        const { data, error } = await supabase
            .from('competitors_news')
            .insert([newsData])
            .select('*');
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('Error guardando reporte de competencia:', error.message);
        throw error;
    }
};

module.exports = { 
    saveMemoryResource, 
    getMemoryByCategory, 
    updateProjectLogo,
    saveIndustryNews,
    appendSavedNews,
    saveCompetitor,
    saveCompetitorsNews
};
