const { formatFiles, generateFiles, names } = require('@nx/devkit');
const path = require('path');

module.exports = async function (tree, schema) {
  const projectRoot = 'apps/mobile/src/app/domain';
  const context = schema.context || 'shared';

  // Determine the subdirectory based on type
  let typeDir = '';
  let templateName = '';

  switch (schema.type) {
    case 'entity':
      typeDir = 'entities';
      templateName = 'entity';
      break;
    case 'value-object':
      typeDir = 'value-objects';
      templateName = 'value-object';
      break;
    case 'repository':
      typeDir = 'repositories';
      templateName = 'repository';
      break;
    case 'service':
      typeDir = 'services';
      templateName = 'service';
      break;
    case 'event':
      typeDir = 'events';
      templateName = 'event';
      break;
  }

  const targetPath = path.join(projectRoot, context, typeDir);

  // Generate files using templates
  generateFiles(
    tree,
    path.join(__dirname, 'files', templateName),
    targetPath,
    {
      ...schema,
      ...names(schema.name),
      tmpl: '',
    }
  );

  await formatFiles(tree);

  console.log(`✅ Created ${schema.type} "${schema.name}" in ${context} context`);
  console.log(`   Location: ${targetPath}`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Implement the ${schema.type} logic`);
  console.log(`   2. Add unit tests`);
  console.log(`   3. Update barrel exports (index.ts)`);

  return function () {
    console.log(`\n🎉 Domain ${schema.type} "${schema.name}" created successfully!`);
  };
};
