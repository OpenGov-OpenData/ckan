this.ckan.module('resource-view-filters', function (jQuery) {
  'use strict';

  function initialize() {
    var self = this,
        resourceId = self.options.resourceId,
        fieldFilters = self.options.fieldFilters,
        dropdownTemplate = self.options.dropdownTemplate,
        searchTemplate = self.options.searchTemplate,
        addFilterTemplate = '<a class="btn btn-primary" href="#">' + self._('Add Filter') + '</a>',
        filtersDiv = $('<div></div>');

    var filters = ckan.views.filters.get();
    _appendDropdowns(filtersDiv, resourceId, dropdownTemplate, searchTemplate, fieldFilters, filters);
    var addFilterButton = _buildAddFilterButton(self, filtersDiv, addFilterTemplate,
                                                fieldFilters, filters, function (evt) {
      // Build filters object with this element's val as key and a placeholder
      // value so _appendDropdowns() will create its dropdown
      var filters = {};
      filters[evt.val] = [];

      $(this).select2('destroy');
      _appendDropdowns(filtersDiv, resourceId, dropdownTemplate, searchTemplate, fieldFilters, filters);
      evt.preventDefault();
    });
    self.el.append(filtersDiv);
    self.el.append(addFilterButton);
  }

  function _buildAddFilterButton(self, el, template, fieldFilters, filters, onChangeCallback) {
    var addFilterButton = $(template),
        currentFilters = Object.keys(filters),
        fieldsNotFiltered = $.grep(fieldFilters, function (field) {
          return !filters.hasOwnProperty(field.id);
        }),
        data = $.map(fieldsNotFiltered, function (d) {
          return { id: d.id, text: d.id };
        });

    if (data.length === 0) {
      return '';
    }

    addFilterButton.click(function (evt) {
      // FIXME: Move this class name to some external variable to keep it DRY
      var addFilterDiv = $('<div class="resource-view-filter"><input type="hidden"></input></div>'),
          addFilterInput = addFilterDiv.find('input');
      el.append(addFilterDiv);

      // TODO: Remove element from "data" when some select selects it.
      addFilterInput.select2({
        data: data,
        placeholder: self._('Select a field'),
        width: 'resolve',
      }).on('change', onChangeCallback);

      evt.preventDefault();
    });

    return addFilterButton;
  }

  function _appendDropdowns(dropdowns, resourceId, dropdownTemplate, searchTemplate, fieldFilters, filters) {
    $.each(fieldFilters, function (i, field) {
      if (filters.hasOwnProperty(field.id)) {
        if (field.filter === 'search') {
          dropdowns.append(_buildSearch(self.el, searchTemplate, field.id));
        } else {
          dropdowns.append(_buildDropdown(self.el, dropdownTemplate, field.id));
        }
      }
    });

    return dropdowns;

    function _buildSearch(el, template, filterName) {
      var theseFilters = filters[filterName] || [];
      template = $(template.replace(/{filter}/g, filterName));
      template.find('input').on('change', _onChange);

      return template;
    }

    function _buildDropdown(el, template, filterName) {
      var theseFilters = filters[filterName] || [];
      template = $(template.replace(/{filter}/g, filterName));
      // FIXME: Get the CSS class from some external variable
      var dropdowns = template.find('.resource-view-filter-values');

      // Can't use push because we need to create a new array, as we're
      // modifying it.
      theseFilters = theseFilters.concat([undefined]);
      theseFilters.forEach(function (value, i) {
        var dropdown = $('<input type="hidden" name="'+filterName+'"></input>');

        if (value !== undefined) {
          dropdown.val(value);
        }

        dropdowns.append(dropdown);
      });

      var queryLimit = 20;
      dropdowns.find('input').select2({
        allowClear: true,
        placeholder: ' ', // select2 needs a placeholder to allow clearing
        width: 'resolve',
        minimumInputLength: 0,
        ajax: {
          url: '/api/3/action/datastore_search',
          datatype: 'json',
          quietMillis: 200,
          cache: true,
          data: function (term, page) {
            var offset = (page - 1) * queryLimit,
                query;

            query = {
              plain: false,
              resource_id: resourceId,
              limit: queryLimit,
              offset: offset,
              fields: filterName,
              distinct: true,
              sort: filterName
            };

            if (term !== '') {
              var q = {};
              q[filterName] = term + ':*';
              query.q = JSON.stringify(q);
            }

            return query;
          },
          results: function (data, page) {
            var records = data.result.records,
                hasMore = (records.length < data.result.total),
                results;

            results = $.map(records, function (record) {
              return { id: record[filterName], text: String(record[filterName]) };
            });

            return { results: results, more: hasMore };
          }
        },
        initSelection: function (element, callback) {
          var data = {id: element.val(), text: element.val()};
          callback(data);
        },
      }).on('change', _onChange);

      return template;
    }
  }

  function _onChange(evt) {
    var filterName = evt.currentTarget.name,
        filterValue = evt.val,
        currentFilters = ckan.views.filters.get(filterName) || [],
        addToIndex = currentFilters.length;

    if (typeof filterValue === "undefined") {
      // plain input field
      filterValue = this.value;
      evt.added = true;
    }

    // Make sure we're not editing the original array, but a copy.
    currentFilters = currentFilters.slice();

    if (evt.removed) {
      addToIndex = currentFilters.indexOf(evt.removed.id);
      if (addToIndex !== -1) {
        currentFilters.splice(addToIndex, 1);
      }
    }
    if (evt.added) {
      currentFilters.splice(addToIndex, 0, filterValue);
    }

    if (currentFilters.length > 0) {
      ckan.views.filters.set(filterName, currentFilters);
    } else {
      ckan.views.filters.unset(filterName);
    }
  }

  return {
    initialize: initialize,
    options: {
      dropdownTemplate: [
        '<div class="resource-view-filter">',
        '  {filter}:',
        '  <div class="resource-view-filter-values"></div>',
        '</div>',
      ].join('\n'),
      searchTemplate: [
        '<div class="resource-view-search">',
        '  {filter}:',
        '  <input type="text" name="{filter}" class="resource-view-search-box"/>',
        '</div>',
      ].join('\n')
    }
  };
});
