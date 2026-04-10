import { updateCourseRecord, loadAppData } from '../lib/store.js';

async function main() {
  const data = await loadAppData();
  const target = data.courses.find(c => c.title.includes('EVA'));
  
  if (target) {
    console.log(`Found course: ${target.title}. Renaming...`);
    await updateCourseRecord(target.slug, {
      ...target,
      title: 'Docencia en Entornos Virtuales',
      institution: target.metadata.institution,
      academicPeriod: target.metadata.academicPeriod,
      courseType: target.metadata.courseType
    } as any);
    console.log('Renamed successfully.');
  } else {
    console.log('Course with EVA not found.');
  }
}

main().catch(console.error);
