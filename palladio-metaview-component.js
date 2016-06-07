/* global angular */
/* global d3 */
angular.module('palladioMetaview', ['palladio', 'palladio.services'])
	.run(['componentService', function(componentService) {
		var compileStringFunction = function (newScope, options) {
			var compileString = '<div data-palladio-metaview></div>';
			return compileString;
		};

		componentService.register('metaview', compileStringFunction);
	}])
	.directive('palladioMetaview', function (palladioService, dataService, parseService, $document) {
		return {
			scope : true,
			templateUrl : 'partials/palladio-metaview-component/template.html',
			link : {
				pre : function(scope, element) {
					scope.fileForArrowIndexChange = null;
					
					scope.clearArrowEffect = function() {
						scope.fileForArrowIndexChange = null;
					}
				},

				post : function(scope, element, attrs) {
					scope.metadata = dataService.getMetadata();
					scope.files = dataService.getFiles();
					scope.links = dataService.getLinks();
					scope.maxRecords = d3.max(scope.files, function(d) { return d.data.length; });

					scope.files.forEach(function(d) {
						d.fields.forEach(function(f) {
							// Re-parse uniques...
							var md = parseService.parseColumn(f.key,
								d.data, f.mvDelimiter,
								f.hierDelimiter, [], f.type);
							f.uniques = md.uniques;
							f.uniqueValues = f.uniques.map(function(u) { return u.key; });
							
							if(f.uniqueKey && f.type === "number") {
								f.type = 'uniqueNumeric';
							}
							if(f.uniqueKey && f.type === "text") {
								f.type = 'uniqueText';
							}
							if(f.uniques.length === 2) {
								f.type = 'binary0';
							}
							if(f.uniques.length > 2 && f.uniques.length < 10 && f.type === 'number') {
								f.type = 'ordinalNumeric';
							}
							if(f.uniques.length > 2 && f.uniques.length < 10 && f.type === 'text') {
								f.type = 'nominalText';
							}
						});
					});
					
					scope.sortFields = function(file) {
						file.fields.forEach(function(f) { scope.sortField(f, file); });
					}
					
					scope.sortField = function(field, file) {
						switch(file.sortMode) {
							case 'Map errors and gaps':
								field.sortedValues = file.data.map(function(d) {
									return d[field.key];
								}).map(function(d) {
									return {
										value: d,
										color: scope.colorCalc(d, 'error', field)
									};
								});
								break;
							case 'Map by data types':
								field.sortedValues = file.data.map(function(d) {
									return d[field.key];
								}).map(function(d) {
									return {
										value: d,
										color: scope.colorCalc(d, 'type', field)
									};
								});
								break;
							case 'Sort by values':
								field.sortedValues = file.data.map(function(d) {
									return d[field.key];
								}).map(function(d) {
									return {
										value: d,
										color: scope.colorCalc(d, 'type', field)
									};
								}).sort(function(a,b) { return a.color < b.color ? -1 : 1; });
								break;
						}
					}

					scope.colors = {
						uniqueNumeric: '#E0CD29',
						uniqueText: '#E07129',
						numeric: '#BBAA1B',
						number: '#BBAA1B',
						text: '#BB5A1B',
						binary0: '#9988C0',
						binary1: '#CD88BD',
						ordinalNumeric: '#767A79',
						nominalText: '#53585F',
						coordinates: '#A1C088',
						latlong: '#A1C088',
						date: '#577AA4',
						YYYYMMDD: '#577AA4',
						YYYYMM: '#88A1C0',
						YYYY: '#A9BBD2',
						url: '#C0A788',
						'null': '#FFFFFF',
						mismatch: '#EC5D57'
					};

					scope.textColors = {
						uniqueNumeric: '#FFFFFF',
						uniqueText: '#FFFFFF',
						numeric: '#FFFFFF',
						number: '#FFFFFF',
						text: '#FFFFFF',
						binary0: '#FFFFFF',
						binary1: '#FFFFFF',
						ordinalNumeric: '#FFFFFF',
						nominalText: '#FFFFFF',
						coordinates: '#FFFFFF',
						latlong: '#FFFFFF',
						date: '#FFFFFF',
						YYYYMMDD: '#FFFFFF',
						YYYYMM: '#FFFFFF',
						YYYY: '#FFFFFF',
						url: '#FFFFFF',
						'null': '#444444',
						mismatch: '#FFFFFF'
					};
					
					scope.typeTexts = {
						uniqueNumeric: 'Unique Numeric',
						uniqueText: 'Unique Text',
						numeric: 'Numeric',
						number: 'Numeric',
						text: 'Text',
						binary0: 'Binary',
						binary1: 'Binary',
						ordinalNumeric: 'Ordinal Numeric (<10 values)',
						nominalText: 'Nominal Text (<10 values)',
						coordinates: 'Coordinates',
						latlong: 'Coordinates',
						date: 'Date',
						YYYYMMDD: 'Date (YYYY-MM-DD)',
						YYYYMM: 'Date (YYYY-MM)',
						YYYY: 'Date (YYYY)',
						url: 'URL',
						'null': 'not defined',
						mismatch: 'match error'
					}
					
					// Set up tooltips
					setTimeout(function() {
						angular.element(element[0]).find('div.dimension-type').tooltip();
					}, 100);
					
					scope.centerTable = function(ev) {
						// Do this async so that page can re-render first and table container can expand.
						function internalUpdate() {
							var tableNode = ev.currentTarget.parentNode.parentNode.parentNode;
							tableNode.parentNode.scrollLeft = tableNode.parentNode.scrollLeft - 30 + tableNode.getBoundingClientRect().left;
						}
						setTimeout(internalUpdate);
					};

					scope.calcPosition = function(file) {
						if($('.table-display')[0].getBoundingClientRect().left < 0) {
							
							return 'absolute';
						}
						return 'relative';
					};
					
					scope.calcTop = function(tada) {
						return $('body')[0].getBoundingClientRect().top;
					}

					$('#tables').scroll(function() { scope.$digest(); });

					scope.colorCalc = function(value, calcType, field) {
						if(calcType === 'error') {
							if(value === null || value === undefined || value === "") return scope.colors['null'];
							if(sniff(value) !== field.type &&
								!(sniff(value) === 'number' && (field.type === 'uniqueNumeric' || field.type === 'ordinalNumeric' )) &&
								!(sniff(value) === 'text' && (field.type === 'uniqueText' || field.type === 'nominalText')) &&
								!(sniff(value) === 'text' && field.type === 'uniqueText') &&
								!((value.length === 4 || value.length === 7) && field.type === 'date') &&
								field.type !== 'binary0' ) {

								return scope.colors.mismatch;
							}
							return '#bbbbbb';
						}
						if(calcType === 'edit') {
							if(sniff(value) !== field.type &&
								!(sniff(value) === 'number' && (field.type === 'uniqueNumeric' || field.type === 'ordinalNumeric' )) &&
								!(sniff(value) === 'text' && (field.type === 'uniqueText' || field.type === 'nominalText')) &&
								!(sniff(value) === 'text' && field.type === 'uniqueText') &&
								field.type !== 'binary0' ) {

								return scope.colors.mismatch;
							}
							return '#bbbbbb';
						}
						if(calcType === 'type') {
							if(field.type === 'ordinalNumeric' && sniff(value) === 'number') {
								return scope.colors['ordinalNumeric'];
							} else if (field.type === 'binary0' && field.uniqueValues && (value === field.uniqueValues[0] || value === field.uniqueValues[1])) {
								return value === field.uniqueValues[0] ? scope.colors['binary0'] : scope.colors['binary1'];
							} else if ( (field.type === 'ordinalNumeric' || field.type === 'nominalText') && value && field.uniqueValues.indexOf(value.split(field.mvDelimiter)[0]) !== -1) {
								return scope.colors[field.type];
							} else {
								return scope.colors[sniff(value)];	
							}
						}
					};
					
					scope.assignIndexAndFile = function(file, index) {
						 file.editIndex = index;
						 scope.fileForArrowIndexChange = file;
					}
					
					$document.keydown(function(ev) {
						scope.$apply(function(s) {
							if(ev.keyCode === 27) { s.files.forEach(function(f) { f.editIndex = null; }); }
							if(ev.keyCode === 37 && scope.fileForArrowIndexChange && scope.fileForArrowIndexChange.editIndex > 0) {
								ev.preventDefault();
								scope.fileForArrowIndexChange.editIndex--;
							}
							if(ev.keyCode === 39 && scope.fileForArrowIndexChange && scope.fileForArrowIndexChange.editIndex < scope.fileForArrowIndexChange.data.length-1) {
								ev.preventDefault();
								scope.fileForArrowIndexChange.editIndex++;
							}
						})
					});

					scope.numberWithValue = function(file, field) {
						return file.data.filter(function(d) { return d[field.key] !== null && d[field.key] !== undefined && d[field.key] !== ""; }).length;
					};

					var isBoolean = function(value) {
						return typeof value == 'boolean';
					};

					var isString = function(value){
						return typeof value == 'string';
					};

					var isArray = function(value){
						return value.toString() == '[object Array]';
					};

					var isNumber = function(value){
						return typeof value == 'number' || RegExp('^\\d*$').test(value);
					};

					var isObject = function(value){
						return value !== null && typeof value == 'object';
					};

					var isDate = function(value){
						return value.toString() == '[object Date]';
					};

					var isFunction = function(value){
						return typeof value == 'function';
					};

					var isBooleanLike = function(value){
						if (value.toLowerCase() === 'true' || value.toLowerCase() === 'yes' || value === 1 ) return true;
						if (value.toLowerCase() === 'false' || value.toLowerCase() === 'no' || value === 0 ) return true;
						return false;
					};

					var isNumberLike = function(value) {
						return !isNaN(value.replace(',','.'));
					};

					var isDateLike = function(value){
						// We allow zero-dates (1999-00-00) even though they aren't technically valid.
						// We allow negative years in dates
						var dateTest = RegExp('^[-]\\d\\d\\d\\d($)|([-](0[0-9]|1[012]|[0-9])[-](0[0-9]|[12][0-9]|3[01]|[0-9])$)');
						if(dateTest.test(value)) return true;
						return false;
					};

					var isLatLonLike = function(value){
						var pieces = value.split(',');
						if (pieces.length !== 2) return false;
						if (isNumberLike(pieces[0]) && isNumberLike(pieces[1])) return true;
						return false;
					};

					var isUrlLike = function(value){
						if ( value.indexOf("https://") === 0 || value.indexOf("http://") === 0 || value.indexOf("www.") === 0 ) return true;
						return false;
					};

					var sniff = function(value) {
						if (typeof value === 'undefined' || value === null || value.length === 0) return 'null';
						if (isObject(value)) return 'object';
						if (isArray(value)) return 'array';
						if (isNumber(value) && value.length === 4) { return 'YYYY'; }
						if (isNumber(value)) return 'number';
						// String
						if (isUrlLike(value)) return 'url';
						//if (isBooleanLike(value)) return 'boolean';
						if (isDateLike(value) && value.length === 4) return 'YYYY';
						if (isDateLike(value) && value.length === 7) return 'YYYYMM';
						// if (isDateLike(value) && value.length === 10) return 'YYYYMMDD';
						if (isDateLike(value)) return 'date';
						if (isNumberLike(value)) return 'number';
						if (isLatLonLike(value)) return 'latlong';
						if (isString(value)) return 'text';
						return null;
					};
				}
			}
		};
	});
