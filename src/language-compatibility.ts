const compatibleLanguageIds: Readonly<Record<string, readonly string[]>> = {
  ini: ['ini', 'properties'],
  properties: ['properties'],
  yaml: ['yaml', 'dockercompose'],
}

export function isCompatibleLanguageId(
  configId: string,
  definitionLanguageId: string,
  currentLanguageId: string,
): boolean {
  return (
    currentLanguageId === definitionLanguageId ||
    compatibleLanguageIds[configId]?.includes(currentLanguageId) === true
  )
}
